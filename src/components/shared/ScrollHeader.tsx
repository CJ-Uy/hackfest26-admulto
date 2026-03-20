import type { ScrollSession } from "@/lib/types";

interface ScrollHeaderProps {
  scroll: ScrollSession;
}

export function ScrollHeader({ scroll }: ScrollHeaderProps) {
  return (
    <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto max-w-[680px] px-4 py-4">
        <h1 className="font-heading text-xl font-bold tracking-tight md:text-2xl">
          {scroll.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {scroll.description}
        </p>
      </div>
    </div>
  );
}
