import { db } from "@/lib/db";
import { comments, papers } from "@/lib/schema";
import { eq, and, gt, isNull, desc } from "drizzle-orm";

export const runtime = "edge";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: scrollId } = await params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      }

      // Track the latest comment timestamp we've seen
      let lastSeen = new Date().toISOString();

      // On first connect, send a heartbeat so the client knows we're alive
      send("connected", { scrollId });

      const poll = async () => {
        try {
          // Find new comments on papers belonging to this scroll
          const newComments = await db
            .select({
              id: comments.id,
              paperId: comments.paperId,
              userPostId: comments.userPostId,
              parentId: comments.parentId,
              content: comments.content,
              author: comments.author,
              isGenerated: comments.isGenerated,
              relationship: comments.relationship,
              createdAt: comments.createdAt,
            })
            .from(comments)
            .innerJoin(papers, eq(comments.paperId, papers.id))
            .where(
              and(
                eq(papers.scrollId, scrollId),
                gt(comments.createdAt, lastSeen),
              ),
            )
            .orderBy(desc(comments.createdAt));

          if (newComments.length > 0) {
            // Update watermark
            lastSeen = newComments[0].createdAt;

            for (const comment of newComments) {
              send("comment", {
                ...comment,
                isGenerated: comment.isGenerated ?? false,
                relationship: comment.relationship ?? null,
                parentId: comment.parentId ?? null,
              });
            }
          }
        } catch (err) {
          console.error("Comment stream poll error:", err);
        }
      };

      // Poll every 2 seconds for new comments
      const interval = setInterval(poll, 2000);

      // Safety timeout: close after 30 minutes
      setTimeout(() => {
        clearInterval(interval);
        try {
          send("timeout", { message: "Stream timeout" });
          controller.close();
        } catch {
          // already closed
        }
      }, 30 * 60 * 1000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
