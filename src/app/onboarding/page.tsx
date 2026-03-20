"use client";

import { useState } from "react";
import { ModeSelector } from "@/components/onboarding/ModeSelector";
import { TopicForm } from "@/components/onboarding/TopicForm";
import { onboardingPresets } from "@/lib/data/onboarding";

export default function OnboardingPage() {
  const [mode, setMode] = useState<"brainstorm" | "citationFinder" | null>(
    null
  );

  const preset = mode ? onboardingPresets[mode] : null;

  return (
    <div className="flex min-h-screen items-start justify-center px-4 py-12 md:items-center md:py-0">
      <div className="animate-fade-in w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            Create a Scroll
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose how you want to explore, then tell us your topic.
          </p>
        </div>

        <ModeSelector selected={mode} onSelect={setMode} />

        <TopicForm preset={preset ?? null} mode={mode} />
      </div>
    </div>
  );
}
