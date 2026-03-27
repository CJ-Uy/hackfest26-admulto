export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { db } from "@/lib/db";
import { comments, papers, userPosts } from "@/lib/schema";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { generateReplyComment, generateUserPostReply } from "@/lib/ollama";
import { webSearch } from "@/lib/search";

export async function GET(req: NextRequest) {
  const paperId = req.nextUrl.searchParams.get("paperId");
  const userPostId = req.nextUrl.searchParams.get("userPostId");

  if (!paperId && !userPostId) {
    return NextResponse.json(
      { error: "paperId or userPostId required" },
      { status: 400 },
    );
  }

  let result;
  if (userPostId) {
    // Fetch comments for a user post
    result = await db
      .select()
      .from(comments)
      .where(eq(comments.userPostId, userPostId))
      .orderBy(desc(comments.createdAt));
  } else {
    // Fetch comments for a paper (exclude user-post comments)
    result = await db
      .select()
      .from(comments)
      .where(and(eq(comments.paperId, paperId!), isNull(comments.userPostId)))
      .orderBy(desc(comments.createdAt));
  }

  return NextResponse.json(
    result.map((c) => ({
      ...c,
      isGenerated: c.isGenerated ?? false,
      relationship: c.relationship ?? null,
      parentId: c.parentId ?? null,
    })),
  );
}

export async function DELETE(req: NextRequest) {
  const commentId = req.nextUrl.searchParams.get("id");
  if (!commentId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const comment = await db.query.comments.findFirst({
    where: eq(comments.id, commentId),
  });

  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  // Delete the comment (cascade will remove child replies)
  await db.delete(comments).where(eq(comments.id, commentId));

  // Decrement comment count on the parent entity
  if (comment.userPostId) {
    await db
      .update(userPosts)
      .set({ commentCount: sql`MAX(${userPosts.commentCount} - 1, 0)` })
      .where(eq(userPosts.id, comment.userPostId));
  } else {
    await db
      .update(papers)
      .set({ commentCount: sql`MAX(${papers.commentCount} - 1, 0)` })
      .where(eq(papers.id, comment.paperId));
  }

  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { paperId, userPostId, content, author, parentId } = body as {
    paperId?: string;
    userPostId?: string;
    content: string;
    author?: string;
    parentId?: string;
  };

  if ((!paperId && !userPostId) || !content) {
    return NextResponse.json(
      { error: "(paperId or userPostId) and content required" },
      { status: 400 },
    );
  }

  // For user post comments, we need an anchor paperId for FK constraint
  let resolvedPaperId = paperId;
  const resolvedUserPostId = userPostId;

  if (userPostId && !paperId) {
    // Look up the user post to find its scroll, then get a paper for FK
    const post = await db
      .select()
      .from(userPosts)
      .where(eq(userPosts.id, userPostId))
      .limit(1);

    if (post.length === 0) {
      return NextResponse.json(
        { error: "User post not found" },
        { status: 404 },
      );
    }

    const scrollPapers = await db
      .select({ id: papers.id })
      .from(papers)
      .where(eq(papers.scrollId, post[0].scrollId))
      .limit(1);

    if (scrollPapers.length === 0) {
      return NextResponse.json(
        { error: "No papers in scroll" },
        { status: 400 },
      );
    }

    resolvedPaperId = scrollPapers[0].id;
  }

  const [comment] = await db
    .insert(comments)
    .values({
      paperId: resolvedPaperId!,
      userPostId: resolvedUserPostId || null,
      content,
      author: author || "You",
      isGenerated: false,
      parentId: parentId || null,
    })
    .returning();

  // Increment comment count on the appropriate entity
  if (resolvedUserPostId) {
    await db
      .update(userPosts)
      .set({ commentCount: sql`${userPosts.commentCount} + 1` })
      .where(eq(userPosts.id, resolvedUserPostId));
  } else {
    await db
      .update(papers)
      .set({ commentCount: sql`${papers.commentCount} + 1` })
      .where(eq(papers.id, resolvedPaperId!));
  }

  // Generate AI reply in background
  after(async () => {
    try {
      // Walk up the thread to build conversation context
      const threadContext: string[] = [];
      let walkId = parentId || null;
      while (walkId) {
        const [ancestor] = await db
          .select()
          .from(comments)
          .where(eq(comments.id, walkId))
          .limit(1);
        if (!ancestor) break;
        threadContext.unshift(`${ancestor.author}: ${ancestor.content}`);
        walkId = ancestor.parentId;
      }

      // Pick a different paper's perspective for the reply in threaded discussions.
      // If the user is replying to a generated comment, the AI should respond
      // from a different paper (to create the debate effect).
      const paper = await db
        .select()
        .from(papers)
        .where(eq(papers.id, resolvedPaperId!))
        .limit(1);

      if (paper.length === 0) return;
      const p = paper[0];

      // Find another paper in this scroll that can provide a different perspective
      let replyPaper = p;
      let replyAuthor: string;

      if (parentId) {
        // Check what author the parent comment was from
        const [parentComment] = await db
          .select()
          .from(comments)
          .where(eq(comments.id, parentId))
          .limit(1);

        if (parentComment?.isGenerated) {
          // The user is replying to an AI comment — the commenter should
          // defend their position, so reply as the same author.
          // Try to find the matching paper for context.
          const otherPapers = await db
            .select()
            .from(papers)
            .where(eq(papers.scrollId, p.scrollId));

          const parentPaper = otherPapers.find((op) => {
            const authors = JSON.parse(op.authors) as string[];
            const authorName = authors[0] ? `${authors[0]} et al.` : op.title;
            return authorName === parentComment.author;
          });

          if (parentPaper) {
            replyPaper = parentPaper;
          }

          // Always use the parent comment's author name so the commenter replies
          replyAuthor = parentComment.author;
        } else {
          // User is replying to a human comment on a paper post —
          // the post's own paper source should reply back
          replyPaper = p;
          const parsedAuthors = JSON.parse(replyPaper.authors) as string[];
          replyAuthor = parsedAuthors[0]
            ? `${parsedAuthors[0]} et al.`
            : replyPaper.title;
        }
      } else {
        const parsedAuthors = JSON.parse(replyPaper.authors) as string[];
        replyAuthor = parsedAuthors[0]
          ? `${parsedAuthors[0]} et al.`
          : replyPaper.title;
      }

      if (resolvedUserPostId) {
        // Reply on a user post — use web search for context
        const post = await db
          .select()
          .from(userPosts)
          .where(eq(userPosts.id, resolvedUserPostId))
          .limit(1);

        if (post.length === 0) return;

        let webContext = "";
        try {
          const results = await webSearch(content.slice(0, 100), 3);
          webContext = results
            .map((r) => `- ${r.title}: ${r.snippet}`)
            .join("\n");
        } catch {
          webContext = post[0].content;
        }

        const replyContent = await generateUserPostReply(
          post[0].content,
          content,
          webContext || post[0].content,
        );

        if (!replyContent?.trim()) return;

        await db.insert(comments).values({
          paperId: resolvedPaperId!,
          userPostId: resolvedUserPostId,
          content: replyContent.trim(),
          author: replyAuthor,
          isGenerated: true,
          parentId: comment.id,
          relationship: "responds",
        });

        await db
          .update(userPosts)
          .set({ commentCount: sql`${userPosts.commentCount} + 1` })
          .where(eq(userPosts.id, resolvedUserPostId));
      } else {
        // Reply on a paper
        const replyPaperAuthors = JSON.parse(replyPaper.authors) as string[];
        const replyContent = await generateReplyComment(
          {
            title: replyPaper.title,
            synthesis: replyPaper.synthesis,
            authors: replyPaperAuthors,
            doi: replyPaper.doi,
          },
          content,
          threadContext.length > 0 ? threadContext : undefined,
        );

        if (!replyContent?.trim()) return;

        await db.insert(comments).values({
          paperId: resolvedPaperId!,
          content: replyContent.trim(),
          author: replyAuthor,
          isGenerated: true,
          parentId: comment.id,
          relationship: "responds",
        });

        await db
          .update(papers)
          .set({ commentCount: sql`${papers.commentCount} + 1` })
          .where(eq(papers.id, resolvedPaperId!));
      }
    } catch (err) {
      console.error("Failed to generate AI reply:", err);
    }
  });

  return NextResponse.json(comment, { status: 201 });
}
