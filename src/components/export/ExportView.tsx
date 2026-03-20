"use client";

import { exportOutline } from "@/lib/data/export-outline";
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

export function ExportView() {
  const markdownText = generateMarkdown(exportOutline);

  return (
    <div className="mx-auto max-w-[680px] px-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Your structured research outline. Generated from your scrolling
          session — use it to jumpstart your paper.
        </p>
        <ExportActions text={markdownText} />
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        {exportOutline.map((theme, i) => (
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

            {i < exportOutline.length - 1 && (
              <div className="mt-8 border-t border-border" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
