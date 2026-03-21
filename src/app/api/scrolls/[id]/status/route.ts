import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const scroll = await db.scroll.findUnique({
    where: { id },
    select: { status: true, progress: true },
  });

  if (!scroll) {
    return Response.json({ error: "Scroll not found" }, { status: 404 });
  }

  return Response.json({
    status: scroll.status,
    progress: scroll.progress ? JSON.parse(scroll.progress) : null,
  });
}
