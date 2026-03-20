import type { ScrollSession } from "@/lib/types";

interface ScrollHeaderProps {
  scroll: ScrollSession;
}

export function ScrollHeader({ scroll }: ScrollHeaderProps) {
  return (
    <div className="px-4 pt-5 pb-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="bg-primary/10 text-primary inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-semibold">
          {scroll.mode === "brainstorm" ? "Brainstorm" : "Citation Finder"}
        </span>
        <span className="text-muted-foreground text-[14px]">
          {scroll.paperCount} papers &middot; {scroll.date}
        </span>
      </div>
      <h1 className="font-heading text-foreground text-[26px] leading-tight font-bold">
        {scroll.title}
      </h1>
      <p className="text-muted-foreground mt-1.5 text-[15px] leading-snug">
        {scroll.description}
      </p>
    </div>
  );
}
