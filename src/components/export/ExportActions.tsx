"use client";

import { useState } from "react";
import {
  Copy,
  Download,
  Check,
  FileText,
  BookOpen,
  Table,
  FileCode,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Paper } from "@/lib/types";

type ExportFormat = "markdown" | "bibtex" | "apa" | "csv";

const FORMATS: { value: ExportFormat; label: string; icon: typeof FileText }[] =
  [
    { value: "markdown", label: "Markdown", icon: FileText },
    { value: "bibtex", label: "BibTeX", icon: FileCode },
    { value: "apa", label: "APA", icon: BookOpen },
    { value: "csv", label: "CSV", icon: Table },
  ];

function generateBibTeX(papers: Paper[]): string {
  return papers
    .map((p, i) => {
      const key = p.authors[0]?.split(" ").pop()?.toLowerCase() ?? "unknown";
      const tag = `${key}${p.year}_${i + 1}`;
      const authors = p.authors.join(" and ") || "Unknown";
      const doi = p.doi.startsWith("http")
        ? p.doi
        : p.doi
          ? `https://doi.org/${p.doi}`
          : "";
      return [
        `@article{${tag},`,
        `  title     = {${p.title}},`,
        `  author    = {${authors}},`,
        `  journal   = {${p.journal}},`,
        `  year      = {${p.year}},`,
        doi ? `  doi       = {${doi}},` : null,
        `  note      = {Citations: ${p.citationCount}}`,
        `}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function generateApaList(papers: Paper[]): string {
  return papers.map((p) => p.apaCitation).join("\n\n");
}

function generateCSV(papers: Paper[]): string {
  const header = "Title,Authors,Journal,Year,DOI,Citations,Credibility Score";
  const rows = papers.map(
    (p) =>
      `"${p.title.replace(/"/g, '""')}","${p.authors.join("; ")}","${p.journal}",${p.year},"${p.doi}",${p.citationCount},${p.credibilityScore}`,
  );
  return [header, ...rows].join("\n");
}

interface ExportActionsProps {
  text: string;
  papers: Paper[];
}

export function ExportActions({ text, papers }: ExportActionsProps) {
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [copied, setCopied] = useState(false);

  function getContent(): string {
    switch (format) {
      case "bibtex":
        return generateBibTeX(papers);
      case "apa":
        return generateApaList(papers);
      case "csv":
        return generateCSV(papers);
      default:
        return text;
    }
  }

  function getExtension(): string {
    switch (format) {
      case "bibtex":
        return "bib";
      case "apa":
        return "txt";
      case "csv":
        return "csv";
      default:
        return "md";
    }
  }

  function getMimeType(): string {
    switch (format) {
      case "csv":
        return "text/csv";
      case "bibtex":
        return "application/x-bibtex";
      default:
        return "text/plain";
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(getContent());
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const blob = new Blob([getContent()], { type: getMimeType() });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `research-export.${getExtension()}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded");
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {/* Format tabs */}
      <div className="bg-muted/60 flex rounded-lg p-1">
        {FORMATS.map((f) => {
          const Icon = f.icon;
          const isActive = format === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setFormat(f.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-all duration-150",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{f.label}</span>
              <span className="sm:hidden">{f.label.slice(0, 3)}</span>
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-1.5">
        <button
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all duration-150",
            copied
              ? "bg-primary/10 text-primary"
              : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          onClick={handleDownload}
          className="bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all duration-150"
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </button>
      </div>
    </div>
  );
}
