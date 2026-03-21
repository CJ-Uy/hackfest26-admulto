"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ModeSelector } from "@/components/onboarding/ModeSelector";
import { TopicForm } from "@/components/onboarding/TopicForm";

function OnboardingContent() {
  const searchParams = useSearchParams();
  const initialTopic = searchParams.get("topic") || undefined;
  const [mode, setMode] = useState<"brainstorm" | "citationFinder" | null>(
    null,
  );

  return (
    <div className="flex min-h-screen items-start justify-center px-4 py-12 md:items-center md:py-0">
      <div className="animate-fade-in w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            Create a Scroll
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Choose how you want to explore, then tell us your topic.
          </p>
        </div>

        <ModeSelector selected={mode} onSelect={setMode} />

        <TopicForm mode={mode} initialTopic={initialTopic} />
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  );
}
