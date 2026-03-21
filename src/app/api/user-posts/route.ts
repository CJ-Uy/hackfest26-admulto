import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { db } from "@/lib/db";
import { userPosts, papers, comments } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { generatePostComments } from "@/lib/ollama";

export async function GET(req: NextRequest) {
  const scrollId = req.nextUrl.searchParams.get("scrollId");
  if (!scrollId) {
    return NextResponse.json({ error: "scrollId required" }, { status: 400 });
  }

  const result = await db
    .select()
    .from(userPosts)
    .where(eq(userPosts.scrollId, scrollId))
    .orderBy(desc(userPosts.createdAt));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { scrollId, title, content } = body as {
    scrollId: string;
    title?: string;
    content: string;
  };

  if (!scrollId || !content) {
    return NextResponse.json(
      { error: "scrollId and content required" },
      { status: 400 },
    );
  }

  const [post] = await db
    .insert(userPosts)
    .values({
      scrollId,
      title: title || null,
      content,
    })
    .returning();

  // Generate AI comments on the post in background
  after(async () => {
    try {
      // Get papers from the same scroll for context
      const scrollPapers = await db
        .select()
        .from(papers)
        .where(eq(papers.scrollId, scrollId))
        .limit(5);

      if (scrollPapers.length === 0) return;

      // Get scroll topic
      const scroll = await db.query.scrolls.findFirst({
        where: (s, { eq }) => eq(s.id, scrollId),
      });

      const paperContexts = scrollPapers.map((p) => ({
        title: p.title,
        synthesis: p.synthesis,
        authors: JSON.parse(p.authors) as string[],
      }));

      const aiComments = await generatePostComments(
        content,
        paperContexts.slice(0, 3),
        scroll?.title || "",
      );

      if (aiComments.length === 0) return;

      // We need a paper to attach these comments to — use the first paper
      // that's most relevant. For simplicity, use the first paper in the scroll.
      // These are "feed comments" attached to a paper but responding to user's post
      const targetPaper = scrollPapers[0];

      for (const c of aiComments) {
        await db.insert(comments).values({
          paperId: targetPaper.id,
          content: c.content,
          author: c.author,
          isGenerated: true,
          relationship: "responds",
        });
      }
    } catch (err) {
      console.error("Failed to generate post comments:", err);
    }
  });

  return NextResponse.json(post, { status: 201 });
}
