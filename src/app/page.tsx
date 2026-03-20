import Link from "next/link";
import { ArrowRight, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
      {/* Background decorative elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-primary/3 blur-3xl" />
      </div>

      {/* Content */}
      <div className="animate-fade-in relative z-10 max-w-xl text-center">
        {/* Logo mark */}
        <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <ScrollText className="h-8 w-8 text-primary" />
        </div>

        {/* App name */}
        <h1 className="font-heading text-5xl font-bold tracking-tight md:text-6xl">
          Schrollar
        </h1>

        {/* Tagline */}
        <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-muted-foreground md:text-xl">
          Turn your scroll into research.
          <br />
          <span className="font-medium text-foreground">
            Every minute produces something useful.
          </span>
        </p>

        {/* CTA */}
        <Link href="/onboarding" className="mt-10 inline-block">
          <Button size="lg" className="gap-2 px-8 text-base">
            Create a Scroll
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>

        {/* Subtle descriptor */}
        <p className="mt-6 text-xs text-muted-foreground/60">
          Research discovery, reimagined as a feed you already know how to use.
        </p>
      </div>
    </div>
  );
}
