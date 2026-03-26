import { NextRequest, NextResponse } from "next/server";
import { buildResearchPrompt } from "@/lib/prompt-builder";

export async function POST(req: NextRequest) {
  const { scrollId } = (await req.json()) as { scrollId: string };

  if (!scrollId) {
    return NextResponse.json(
      { error: "scrollId is required" },
      { status: 400 },
    );
  }

  try {
    const prompt = await buildResearchPrompt(scrollId);
    return NextResponse.json({ prompt });
  } catch (err) {
    console.error("Failed to build research prompt:", err);
    return NextResponse.json(
      { error: "Failed to generate research prompt" },
      { status: 500 },
    );
  }
}
