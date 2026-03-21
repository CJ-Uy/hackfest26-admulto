"use client";

import { Copy, Download } from "lucide-react";
import { toast } from "sonner";

interface ExportActionsProps {
  text: string;
}

export function ExportActions({ text }: ExportActionsProps) {
  function handleCopy() {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  function handleDownload() {
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "research-outline.md";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded");
  }

  return (
    <div className="flex shrink-0 gap-1">
      <button
        onClick={handleCopy}
        className="text-muted-foreground flex items-center gap-1 rounded-full bg-[#f6f7f8] px-3 py-1 text-[12px] font-semibold transition-colors hover:bg-[#e8e8e8]"
      >
        <Copy className="h-3.5 w-3.5" /> Copy
      </button>
      <button
        onClick={handleDownload}
        className="text-muted-foreground flex items-center gap-1 rounded-full bg-[#f6f7f8] px-3 py-1 text-[12px] font-semibold transition-colors hover:bg-[#e8e8e8]"
      >
        <Download className="h-3.5 w-3.5" /> Download
      </button>
    </div>
  );
}
