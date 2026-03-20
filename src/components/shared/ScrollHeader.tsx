import type { ScrollSession } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

interface ScrollHeaderProps {
  scroll: ScrollSession;
}

export function ScrollHeader({ scroll }: ScrollHeaderProps) {
  return (
    <div className="border-b border-border px-4 py-6">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="secondary" className="text-xs">
          {scroll.mode === "brainstorm" ? "Brainstorm" : "Citation Finder"}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {scroll.paperCount} papers &middot; {scroll.date}
        </span>
      </div>
      <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">
        {scroll.title}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {scroll.description}
      </p>
    </div>
  );
}
