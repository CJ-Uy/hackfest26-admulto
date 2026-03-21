import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { db } from "@/lib/db";
import { comments, papers } from "@/lib/schema";
import { eq, desc, sql } from "drizzle-orm";
import { generateReplyComment } from "@/lib/ollama";

export async function GET(req: NextRequest) {
  const paperId = req.nextUrl.searchParams.get("paperId");
  if (!paperId) {
    return NextResponse.json({ error: "paperId required" }, { status: 400 });
  }

  const result = await db
    .select()
    .from(comments)
    .where(eq(comments.paperId, paperId))
    .orderBy(desc(comments.createdAt));

  return NextResponse.json(
    result.map((c) => ({
      ...c,
      isGenerated: c.isGenerated ?? false,
      relationship: c.relationship ?? null,
      parentId: c.parentId ?? null,
    })),
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { paperId, content, author, parentId } = body as {
    paperId: string;
    content: string;
    author?: string;
    parentId?: string;
  };

  if (!paperId || !content) {
    return NextResponse.json(
      { error: "paperId and content required" },
      { status: 400 },
    );
  }

  const [comment] = await db
    .insert(comments)
    .values({
      paperId,
      content,
      author: author || "You",
      isGenerated: false,
      parentId: parentId || null,
    })
    .returning();

  // Increment comment count on the paper
  await db
    .update(papers)
    .set({ commentCount: sql`${papers.commentCount} + 1` })
    .where(eq(papers.id, paperId));

  // Generate AI reply in background
  after(async () => {
    try {
      // Determine which paper context to use for the reply
      const replyPaperId = paperId;
      let replyAuthorSource: string | null = null;

      // If replying to an AI-generated comment, use that comment's source paper context
      if (parentId) {
        const parentComment = await db
          .select()
          .from(comments)
          .where(eq(comments.id, parentId))
          .limit(1);

        if (parentComment.length > 0 && parentComment[0].isGenerated) {
          replyAuthorSource = parentComment[0].author;
        }
      }

      const paper = await db
        .select()
        .from(papers)
        .where(eq(papers.id, replyPaperId))
        .limit(1);

      if (paper.length === 0) return;

      const p = paper[0];
      const parsedAuthors = JSON.parse(p.authors) as string[];

      const replyContent = await generateReplyComment(
        {
          title: p.title,
          synthesis: p.synthesis,
          authors: parsedAuthors,
        },
        content,
      );

      if (!replyContent?.trim()) return;

      const replyAuthor = replyAuthorSource
        || (parsedAuthors[0] ? `${parsedAuthors[0]} et al.` : p.title);

      await db.insert(comments).values({
        paperId,
        content: replyContent.trim(),
        author: replyAuthor,
        isGenerated: true,
        parentId: comment.id,
        relationship: "responds",
      });

      // Increment comment count for the AI reply too
      await db
        .update(papers)
        .set({ commentCount: sql`${papers.commentCount} + 1` })
        .where(eq(papers.id, paperId));
    } catch (err) {
      console.error("Failed to generate AI reply:", err);
    }
  });

  return NextResponse.json(comment, { status: 201 });
}
