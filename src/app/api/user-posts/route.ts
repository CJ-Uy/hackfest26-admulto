import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { db } from "@/lib/db";
import { userPosts, papers, comments } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import {
  generateWebInformedComments,
  generatePostComments,
} from "@/lib/ollama";
import { webSearch } from "@/lib/search";

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

export async function DELETE(req: NextRequest) {
  const postId = req.nextUrl.searchParams.get("id");
  if (!postId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const post = await db.query.userPosts.findFirst({
    where: eq(userPosts.id, postId),
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Delete user post (cascade removes comments)
  await db.delete(userPosts).where(eq(userPosts.id, postId));

  return NextResponse.json({ success: true });
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
      // Get a paper from the scroll (needed for paperId FK on comments)
      const scrollPapers = await db
        .select()
        .from(papers)
        .where(eq(papers.scrollId, scrollId))
        .limit(1);

      if (scrollPapers.length === 0) return;
      const anchorPaperId = scrollPapers[0].id;

      // Get scroll topic
      const scroll = await db.query.scrolls.findFirst({
        where: (s, { eq }) => eq(s.id, scrollId),
      });
      const topic = scroll?.title || "";

      // Web search based on the post content for informed comments
      let aiComments: Array<{
        author: string;
        content: string;
        relationship: string;
      }> = [];

      try {
        const searchQuery = title
          ? `${title} ${content.slice(0, 100)}`
          : content.slice(0, 150);
        const webResults = await webSearch(searchQuery, 4);

        if (webResults.length > 0) {
          aiComments = await generateWebInformedComments(
            content,
            webResults,
            topic,
          );
        }
      } catch (err) {
        console.error(
          "[user-posts] Web search failed, falling back to paper context:",
          err,
        );
      }

      // Fallback: use paper context if web search didn't produce results
      if (aiComments.length === 0) {
        const morePapers = await db
          .select()
          .from(papers)
          .where(eq(papers.scrollId, scrollId))
          .limit(5);

        const paperContexts = morePapers.map((p) => ({
          title: p.title,
          synthesis: p.synthesis,
          authors: JSON.parse(p.authors) as string[],
          doi: p.doi,
        }));

        aiComments = await generatePostComments(
          content,
          paperContexts.slice(0, 3),
          topic,
        );
      }

      if (aiComments.length === 0) return;

      // Store comments with userPostId so they can be queried for the user post
      for (const c of aiComments) {
        await db.insert(comments).values({
          paperId: anchorPaperId,
          userPostId: post.id,
          content: c.content,
          author: c.author,
          isGenerated: true,
          relationship: "responds",
        });
      }

      // Update comment count on the user post
      await db
        .update(userPosts)
        .set({ commentCount: aiComments.length })
        .where(eq(userPosts.id, post.id));
    } catch (err) {
      console.error("Failed to generate post comments:", err);
    }
  });

  return NextResponse.json(post, { status: 201 });
}
