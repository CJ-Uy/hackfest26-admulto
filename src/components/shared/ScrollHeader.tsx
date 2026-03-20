import type { ScrollSession } from "@/lib/types";

interface ScrollHeaderProps {
  scroll: ScrollSession;
}

export function ScrollHeader({ scroll }: ScrollHeaderProps) {
  return (
    <div className="px-4 pt-5 pb-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[13px] font-semibold text-primary">
          {scroll.mode === "brainstorm" ? "Brainstorm" : "Citation Finder"}
        </span>
        <span className="text-[14px] text-muted-foreground">
          {scroll.paperCount} papers &middot; {scroll.date}
        </span>
      </div>
      <h1 className="font-heading text-[26px] font-bold leading-tight text-foreground">
        {scroll.title}
      </h1>
      <p className="mt-1.5 text-[15px] leading-snug text-muted-foreground">
        {scroll.description}
      </p>
    </div>
  );
}
