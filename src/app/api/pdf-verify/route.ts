import { NextRequest, NextResponse } from "next/server";
import { getPdf } from "@/lib/r2";
import { extractPdfContent } from "@/lib/pdf-extract";
import { generatePdfVerificationQuestions } from "@/lib/ollama";

export async function POST(req: NextRequest) {
  try {
    const { pdfKey } = (await req.json()) as { pdfKey: string };

    if (!pdfKey) {
      return NextResponse.json(
        { error: "pdfKey is required" },
        { status: 400 },
      );
    }

    // Retrieve PDF from R2
    const buffer = await getPdf(pdfKey);
    if (!buffer) {
      return NextResponse.json({ error: "PDF not found" }, { status: 404 });
    }

    // Extract text
    const extracted = await extractPdfContent(buffer, pdfKey);

    // Generate verification questions
    const questions = await generatePdfVerificationQuestions(
      extracted.title,
      extracted.abstract,
      extracted.text,
    );

    return NextResponse.json({
      title: extracted.title,
      authors: extracted.authors,
      questions,
    });
  } catch (err) {
    console.error("PDF verification failed:", err);
    return NextResponse.json(
      { error: "Failed to generate verification questions" },
      { status: 500 },
    );
  }
}
