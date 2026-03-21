import { NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

export async function GET() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json({ models: [] });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const models = ((data.models as any[]) || [])
      .filter((m) => !m.name.includes("embed")) // filter out embedding models
      .map((m) => ({
        name: m.name as string,
        size: m.size as number,
        parameterSize: m.details?.parameter_size as string | undefined,
        family: m.details?.family as string | undefined,
      }))
      .sort((a, b) => (a.size || 0) - (b.size || 0)); // smallest first

    return NextResponse.json({ models });
  } catch {
    return NextResponse.json({ models: [] });
  }
}
