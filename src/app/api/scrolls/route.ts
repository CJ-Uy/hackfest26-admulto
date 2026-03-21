import { db } from "@/lib/db";
import { scrolls } from "@/lib/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const result = await db
    .select({
      id: scrolls.id,
      title: scrolls.title,
      description: scrolls.description,
      mode: scrolls.mode,
      date: scrolls.date,
      paperCount: scrolls.paperCount,
    })
    .from(scrolls)
    .orderBy(desc(scrolls.createdAt));

  return Response.json(result);
}
