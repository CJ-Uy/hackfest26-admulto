import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const paperId = req.nextUrl.searchParams.get("paperId");
  if (!paperId) {
    return NextResponse.json({ error: "paperId required" }, { status: 400 });
  }

  const comments = await db.comment.findMany({
    where: { paperId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    comments.map((c) => ({
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

  const [comment] = await db.$transaction([
    db.comment.create({
      data: {
        paperId,
        content,
        author: author || "You",
        isGenerated: false,
      },
    }),
    db.paper.update({
      where: { id: paperId },
      data: { commentCount: { increment: 1 } },
    }),
  ]);

  return NextResponse.json(comment, { status: 201 });
}
