"use client";

import { Compass, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModeSelectorProps {
  selected: "brainstorm" | "citationFinder" | null;
  onSelect: (mode: "brainstorm" | "citationFinder") => void;
}

const modes = [
  {
    key: "brainstorm" as const,
    title: "Brainstorm Mode",
    subtitle: "Explore a topic",
    description:
      "Discover papers in a broad area. Great for early-stage research when you want to see what's out there.",
    icon: Compass,
  },
  {
    key: "citationFinder" as const,
    title: "Citation Finder",
    subtitle: "Supplement your paper",
    description:
      "Find supporting sources for a paper you're already writing. Targeted search for specific claims.",
    icon: BookOpen,
  },
];

export function ModeSelector({ selected, onSelect }: ModeSelectorProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {modes.map((mode) => {
        const Icon = mode.icon;
        const isSelected = selected === mode.key;
        return (
          <button
            key={mode.key}
            onClick={() => onSelect(mode.key)}
            className={cn(
              "group rounded-xl border-2 p-6 text-left transition-all",
              isSelected
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-primary/40 hover:bg-accent/50",
            )}
          >
            <div
              className={cn(
                "mb-3 flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="font-heading text-base font-bold">{mode.title}</h3>
            <p className="text-primary/70 mt-0.5 text-sm font-medium">
              {mode.subtitle}
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              {mode.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
