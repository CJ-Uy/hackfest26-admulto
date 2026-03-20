import { db } from "@/lib/db";

export async function GET() {
  const scrolls = await db.scroll.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      mode: true,
      date: true,
      paperCount: true,
    },
  });

  return Response.json(scrolls);
}
