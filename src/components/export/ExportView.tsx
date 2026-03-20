"use client";

import { useState, useEffect } from "react";
import { fetchScroll } from "@/lib/scroll-store";
import { ExportActions } from "./ExportActions";
import type { ExportTheme } from "@/lib/types";

function generateMarkdown(themes: ExportTheme[]): string {
  return themes
    .map(
      (theme) =>
        `## ${theme.title}\n\n${theme.summary}\n\n### Sources\n\n${theme.sources
          .map(
            (s) =>
              `- **${s.title}** (${s.authors}, ${s.year})\n  Key finding: ${s.keyFinding}\n  ${s.apaCitation}`
          )
          .join("\n\n")}`
    )
    .join("\n\n---\n\n");
}

interface ExportViewProps {
  scrollId: string;
}

export function ExportView({ scrollId }: ExportViewProps) {
  const [outline, setOutline] = useState<ExportTheme[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const stored = await fetchScroll(scrollId);
      if (cancelled) return;

      if (stored && stored.exportOutline.length > 0) {
        setOutline(stored.exportOutline);
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [scrollId]);

  if (loading) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">Loading outline...</p>
      </div>
    );
  }

  const markdownText = generateMarkdown(outline);

  if (outline.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No export data available yet.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Your structured research outline.
        </p>
        <ExportActions text={markdownText} />
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        {outline.map((theme, i) => (
          <div key={theme.title} className={i > 0 ? "mt-8" : ""}>
            <h2 className="font-heading text-lg font-bold tracking-tight">
              {theme.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {theme.summary}
            </p>

            <h3 className="mt-4 text-xs font-semibold tracking-wide uppercase text-muted-foreground">
              Sources
            </h3>
            <div className="mt-3 space-y-4">
              {theme.sources.map((source) => (
                <div
                  key={source.title}
                  className="rounded-md border border-border bg-muted/30 p-4"
                >
                  <p className="text-sm font-semibold">{source.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {source.authors} ({source.year})
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    <span className="font-medium">Key finding:</span>{" "}
                    {source.keyFinding}
                  </p>
                  <p className="mt-2 rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                    {source.apaCitation}
                  </p>
                </div>
              ))}
            </div>

            {i < outline.length - 1 && (
              <div className="mt-8 border-t border-border" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
