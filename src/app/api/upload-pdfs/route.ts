import { NextResponse } from "next/server";
import { uploadPdf } from "@/lib/r2";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB total

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 },
      );
    }

    // Validate files
    let totalSize = 0;
    for (const file of files) {
      if (file.type !== "application/pdf") {
        return NextResponse.json(
          { error: `File "${file.name}" is not a PDF` },
          { status: 400 },
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File "${file.name}" exceeds 10MB limit` },
          { status: 400 },
        );
      }
      totalSize += file.size;
    }

    if (totalSize > MAX_TOTAL_SIZE) {
      return NextResponse.json(
        { error: "Total upload size exceeds 50MB limit" },
        { status: 400 },
      );
    }

    // Upload each file to R2
    const uploads = await Promise.all(
      files.map(async (file) => {
        const buffer = await file.arrayBuffer();
        const key = await uploadPdf(buffer, file.name);
        return { key, filename: file.name, size: file.size };
      }),
    );

    return NextResponse.json({ uploads });
  } catch (err) {
    console.error("PDF upload failed:", err);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 },
    );
  }
}
