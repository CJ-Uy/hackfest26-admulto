import type { ScrollSession } from "@/lib/types";

interface ScrollHeaderProps {
  scroll: ScrollSession;
}

export function ScrollHeader({ scroll }: ScrollHeaderProps) {
  return (
    <div className="overflow-hidden px-4 pt-14 pb-3 md:pt-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="bg-primary/10 text-primary inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-semibold">
          {scroll.mode === "pdf_only"
            ? "PDF Only"
            : scroll.mode === "pdf_context"
              ? "PDF + Research"
              : scroll.mode === "pdf_include"
                ? "PDF + Research"
                : scroll.mode === "brainstorm"
                  ? "Brainstorm"
                  : "Research"}
        </span>
        <span className="text-muted-foreground text-[14px]">
          {scroll.paperCount} papers &middot; {scroll.date}
        </span>
      </div>
      <h1 className="font-heading text-foreground text-[20px] leading-tight font-bold sm:text-[26px]">
        {scroll.title}
      </h1>
      <p className="text-muted-foreground mt-1.5 text-[14px] leading-snug sm:text-[15px]">
        {scroll.description}
      </p>
    </div>
  );
}
