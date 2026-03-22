import { db } from "@/lib/db";
import {
  papers,
  votes,
  bookmarks,
  comments,
  polls,
  pollResponses,
  userPosts,
  scrolls,
} from "@/lib/schema";
import { eq, and } from "drizzle-orm";

export interface InteractionContext {
  topic: string;
  description: string;
  upvotedPapers: Array<{ title: string; synthesis: string }>;
  downvotedPapers: Array<{ title: string; synthesis: string }>;
  bookmarkedPapers: Array<{ title: string; synthesis: string }>;
  commentedPapers: Array<{
    title: string;
    synthesis: string;
    userComments: string[];
  }>;
  pollAnswers: Array<{ question: string; answer: string }>;
  userPostContent: string[];
  existingTitles: Set<string>;
}

export async function gatherInteractionContext(
  scrollId: string,
): Promise<InteractionContext> {
  // Get scroll info
  const scroll = await db.query.scrolls.findFirst({
    where: eq(scrolls.id, scrollId),
  });

  // Get all papers in scroll
  const allPapers = await db
    .select()
    .from(papers)
    .where(eq(papers.scrollId, scrollId));

  const existingTitles = new Set(allPapers.map((p) => p.title.toLowerCase()));

  // Get upvoted papers (value = 1)
  const upvotedRows = await db
    .select({ title: papers.title, synthesis: papers.synthesis })
    .from(votes)
    .innerJoin(papers, eq(votes.paperId, papers.id))
    .where(and(eq(papers.scrollId, scrollId), eq(votes.value, 1)));

  // Get downvoted papers (value = -1)
  const downvotedRows = await db
    .select({ title: papers.title, synthesis: papers.synthesis })
    .from(votes)
    .innerJoin(papers, eq(votes.paperId, papers.id))
    .where(and(eq(papers.scrollId, scrollId), eq(votes.value, -1)));

  // Get bookmarked papers
  const bookmarkedRows = await db
    .select({ title: papers.title, synthesis: papers.synthesis })
    .from(bookmarks)
    .innerJoin(papers, eq(bookmarks.paperId, papers.id))
    .where(eq(papers.scrollId, scrollId));

  // Get papers with user comments
  const userCommentRows = await db
    .select({
      paperId: comments.paperId,
      content: comments.content,
      paperTitle: papers.title,
      paperSynthesis: papers.synthesis,
    })
    .from(comments)
    .innerJoin(papers, eq(comments.paperId, papers.id))
    .where(
      and(
        eq(papers.scrollId, scrollId),
        eq(comments.isGenerated, false),
        eq(comments.author, "You"),
      ),
    );

  const commentedMap = new Map<
    string,
    { title: string; synthesis: string; userComments: string[] }
  >();
  for (const row of userCommentRows) {
    if (!commentedMap.has(row.paperId)) {
      commentedMap.set(row.paperId, {
        title: row.paperTitle,
        synthesis: row.paperSynthesis,
        userComments: [],
      });
    }
    commentedMap.get(row.paperId)!.userComments.push(row.content);
  }

  // Get poll responses
  const pollRows = await db
    .select({
      question: polls.question,
      answer: pollResponses.answer,
    })
    .from(pollResponses)
    .innerJoin(polls, eq(pollResponses.pollId, polls.id))
    .where(eq(polls.scrollId, scrollId));

  // Get user posts
  const postRows = await db
    .select({ content: userPosts.content })
    .from(userPosts)
    .where(eq(userPosts.scrollId, scrollId));

  return {
    topic: scroll?.title || "",
    description: scroll?.description || "",
    upvotedPapers: upvotedRows,
    downvotedPapers: downvotedRows,
    bookmarkedPapers: bookmarkedRows,
    commentedPapers: Array.from(commentedMap.values()),
    pollAnswers: pollRows,
    userPostContent: postRows.map((p) => p.content),
    existingTitles,
  };
}

/**
 * Build a refined search query from interaction context.
 */
export function buildRefinedQuery(ctx: InteractionContext): string {
  const parts: string[] = [ctx.topic];

  // Collect keywords from downvoted papers to avoid similar content
  const stopWords = [
    "about",
    "using",
    "based",
    "their",
    "these",
    "which",
    "study",
    "research",
    "analysis",
    "review",
    "paper",
  ];
  const downvotedKeywords = new Set(
    ctx.downvotedPapers.flatMap((p) =>
      p.title
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4 && !stopWords.includes(w)),
    ),
  );

  // Add keywords from upvoted/bookmarked papers (excluding downvoted keywords)
  const engagedPapers = [...ctx.upvotedPapers, ...ctx.bookmarkedPapers];
  if (engagedPapers.length > 0) {
    // Extract key terms from engaged paper titles
    const keywords = engagedPapers
      .slice(0, 3)
      .map((p) => {
        // Extract meaningful words from title
        const words = p.title
          .toLowerCase()
          .split(/\s+/)
          .filter(
            (w) =>
              w.length > 4 &&
              !stopWords.includes(w) &&
              !downvotedKeywords.has(w),
          );
        return words.slice(0, 2).join(" ");
      })
      .filter(Boolean);

    if (keywords.length > 0) {
      parts.push(keywords.join(" "));
    }
  }

  // Add poll answer context
  for (const pa of ctx.pollAnswers.slice(0, 2)) {
    if (pa.answer && pa.answer.length > 5) {
      parts.push(pa.answer);
    }
  }

  // Add user post keywords
  for (const post of ctx.userPostContent.slice(0, 2)) {
    const words = post.split(/\s+/).slice(0, 5).join(" ");
    if (words.length > 5) {
      parts.push(words);
    }
  }

  return parts.join(" ");
}
