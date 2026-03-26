import { db } from "@/lib/db";
import { papers, votes, bookmarks, comments } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import type { PaperTier, ScoredPaper } from "@/lib/types";

// Weights for engagement scoring
const UPVOTE_WEIGHT = 3;
const BOOKMARK_WEIGHT = 2;
const USER_COMMENT_WEIGHT = 1;
const DOWNVOTE_WEIGHT = -2;
const BASE_SCORE = 1;

function classifyTier(score: number, maxScore: number): PaperTier {
  if (score >= 4 && score >= maxScore * 0.6) return "core";
  if (score >= 2 && score >= maxScore * 0.3) return "supporting";
  return "peripheral";
}

export async function computeEngagementScores(
  scrollId: string,
): Promise<ScoredPaper[]> {
  // Fetch all data in parallel (same pattern as interaction-context.ts)
  const [allPapers, voteRows, bookmarkRows, userCommentRows] =
    await Promise.all([
      db.select().from(papers).where(eq(papers.scrollId, scrollId)),

      db
        .select({ paperId: votes.paperId, value: votes.value })
        .from(votes)
        .innerJoin(papers, eq(votes.paperId, papers.id))
        .where(eq(papers.scrollId, scrollId)),

      db
        .select({ paperId: bookmarks.paperId })
        .from(bookmarks)
        .innerJoin(papers, eq(bookmarks.paperId, papers.id))
        .where(eq(papers.scrollId, scrollId)),

      db
        .select({ paperId: comments.paperId })
        .from(comments)
        .innerJoin(papers, eq(comments.paperId, papers.id))
        .where(
          and(
            eq(papers.scrollId, scrollId),
            eq(comments.isGenerated, false),
            eq(comments.author, "You"),
          ),
        ),
    ]);

  // Build lookup maps
  const voteMap = new Map<string, number>();
  for (const v of voteRows) {
    voteMap.set(v.paperId, v.value);
  }

  const bookmarkSet = new Set(bookmarkRows.map((b) => b.paperId));

  const commentCountMap = new Map<string, number>();
  for (const c of userCommentRows) {
    commentCountMap.set(c.paperId, (commentCountMap.get(c.paperId) || 0) + 1);
  }

  // Score each paper
  const scored = allPapers.map((p) => {
    const voteValue = voteMap.get(p.id) ?? 0;
    const isUpvoted = voteValue === 1;
    const isDownvoted = voteValue === -1;
    const isBookmarked = bookmarkSet.has(p.id);
    const userCommentCount = commentCountMap.get(p.id) || 0;

    const engagementScore =
      BASE_SCORE +
      (isUpvoted ? UPVOTE_WEIGHT : 0) +
      (isDownvoted ? DOWNVOTE_WEIGHT : 0) +
      (isBookmarked ? BOOKMARK_WEIGHT : 0) +
      userCommentCount * USER_COMMENT_WEIGHT;

    return {
      id: p.id,
      title: p.title,
      authors: JSON.parse(p.authors) as string[],
      year: p.year,
      synthesis: p.synthesis,
      apaCitation: p.apaCitation,
      doi: p.doi,
      credibilityScore: p.credibilityScore,
      citationCount: p.citationCount,
      engagementScore,
      tier: "peripheral" as PaperTier, // placeholder, classified below
      signals: {
        upvoted: isUpvoted,
        downvoted: isDownvoted,
        bookmarked: isBookmarked,
        userCommentCount,
      },
    };
  });

  // Classify tiers based on relative + absolute thresholds
  const maxScore = Math.max(...scored.map((s) => s.engagementScore), 1);
  for (const paper of scored) {
    paper.tier = classifyTier(paper.engagementScore, maxScore);
  }

  // Sort by engagement score descending
  scored.sort((a, b) => b.engagementScore - a.engagementScore);

  return scored;
}
