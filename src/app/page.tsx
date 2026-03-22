import { db } from "@/lib/db";
import { scrolls } from "@/lib/schema";
import { desc } from "drizzle-orm";
import { HomeContent } from "@/components/home/HomeContent";

export const dynamic = "force-dynamic";

export default async function Home() {
  const allScrolls = await db
    .select({
      id: scrolls.id,
      title: scrolls.title,
      description: scrolls.description,
      mode: scrolls.mode,
      date: scrolls.date,
      paperCount: scrolls.paperCount,
      status: scrolls.status,
    })
    .from(scrolls)
    .orderBy(desc(scrolls.createdAt));

  return <HomeContent scrolls={allScrolls} />;
}
