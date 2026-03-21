import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { comments, papers } from "@/lib/schema";
import { eq, desc, sql } from "drizzle-orm";

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
    })),
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { paperId, content, author } = body as {
    paperId: string;
    content: string;
    author?: string;
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
    })
    .returning();

  // Increment comment count on the paper
  await db
    .update(papers)
    .set({ commentCount: sql`${papers.commentCount} + 1` })
    .where(eq(papers.id, paperId));

  return NextResponse.json(comment, { status: 201 });
}
