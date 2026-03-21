"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TopicForm } from "@/components/onboarding/TopicForm";

function OnboardingContent() {
  const searchParams = useSearchParams();
  const initialTopic = searchParams.get("topic") || undefined;

  return (
    <div className="flex min-h-screen items-start justify-center px-4 py-12 md:items-center md:py-0">
      <div className="animate-fade-in w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            Create a Scroll
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Configure your research feed and start exploring.
          </p>
        </div>

        <TopicForm initialTopic={initialTopic} />
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
