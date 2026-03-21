import { db } from "@/lib/db";
import { scrolls } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const runtime = "edge";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      }

      let lastProgress = "";
      let lastStatus = "";

      const poll = async () => {
        try {
          const scroll = await db.query.scrolls.findFirst({
            where: eq(scrolls.id, id),
          });

          if (!scroll) {
            send("error", { message: "Schroll not found" });
            controller.close();
            return true;
          }

          const currentProgress = scroll.progress || "";
          const currentStatus = scroll.status || "";

          // Only send when something changed
          if (
            currentProgress !== lastProgress ||
            currentStatus !== lastStatus
          ) {
            lastProgress = currentProgress;
            lastStatus = currentStatus;

            if (currentStatus === "complete") {
              send("complete", { status: "complete" });
              controller.close();
              return true;
            }

            if (currentStatus === "error") {
              const progress = currentProgress
                ? JSON.parse(currentProgress)
                : { message: "Unknown error" };
              send("error", progress);
              controller.close();
              return true;
            }

            // Send progress update
            const progress = currentProgress
              ? JSON.parse(currentProgress)
              : null;
            send("progress", {
              status: currentStatus,
              progress,
            });
          }

          return false;
        } catch (err) {
          console.error("SSE poll error:", err);
          send("error", {
            message: err instanceof Error ? err.message : "Stream error",
          });
          controller.close();
          return true;
        }
      };

      // Poll DB every 1 second and push changes
      const interval = setInterval(async () => {
        const done = await poll();
        if (done) clearInterval(interval);
      }, 1000);

      // Initial check immediately
      await poll();

      // Safety timeout: close after 5 minutes
      setTimeout(
        () => {
          clearInterval(interval);
          try {
            send("error", { message: "Stream timeout" });
            controller.close();
          } catch {
            // already closed
          }
        },
        5 * 60 * 1000,
      );
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
