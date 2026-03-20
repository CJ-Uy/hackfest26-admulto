"use client";

import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ExportActionsProps {
  text: string;
}

export function ExportActions({ text }: ExportActionsProps) {
  function handleCopy() {
    navigator.clipboard.writeText(text);
    toast.success("Outline copied!");
  }

  function handleDownload() {
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "research-outline.md";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Outline downloaded!");
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handleCopy}>
        <Copy className="mr-1.5 h-3.5 w-3.5" />
        Copy
      </Button>
      <Button variant="outline" size="sm" onClick={handleDownload}>
        <Download className="mr-1.5 h-3.5 w-3.5" />
        Download
      </Button>
    </div>
  );
}
