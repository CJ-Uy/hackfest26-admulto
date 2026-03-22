"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, FileText, Sparkles } from "lucide-react";
import { TopicForm } from "@/components/onboarding/TopicForm";
import { Sidebar } from "@/components/shared/Sidebar";
import { SchrollarLogo } from "@/components/shared/SchrollarLogo";
import { Button } from "@/components/ui/button";

function OnboardingContent() {
  const searchParams = useSearchParams();
  const initialTopic = searchParams.get("topic") || undefined;

  return (
    <div className="flex min-h-screen bg-[#dae0e6]">
      <Sidebar />

      <div className="flex flex-1 justify-center gap-0 lg:gap-6 lg:px-6 lg:py-4">
        <main className="bg-background w-full max-w-[780px] flex-1 lg:rounded-t-lg">
          <div className="border-border border-b px-4 pt-14 pb-4 md:pt-5">
            <div className="mb-2 flex items-center justify-between">
              <h1 className="font-heading text-foreground text-[24px] font-bold tracking-tight">
                Create a Schroll
              </h1>
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </Button>
              </Link>
            </div>
            <p className="text-muted-foreground text-[14px]">
              Configure your research feed and start exploring.
            </p>
          </div>

          <div className="px-4 pb-6">
            <div className="animate-fade-in mx-auto w-full max-w-2xl">
              <TopicForm initialTopic={initialTopic} />
            </div>
          </div>
        </main>

        <aside className="no-scrollbar hidden w-[340px] shrink-0 lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-32px)] lg:overflow-y-auto">
          <div className="space-y-3">
            <div className="border-border bg-background rounded-lg border p-4">
              <div className="bg-primary mb-3 rounded-md px-3 py-2.5">
                <SchrollarLogo size="sm" className="text-primary-foreground" />
              </div>
              <p className="text-muted-foreground text-[14px] leading-relaxed">
                Define your topic, optionally include PDFs, and let Schrollar
                build your personalized research feed.
              </p>
            </div>

            <div className="border-border bg-background rounded-lg border p-4">
              <h4 className="text-foreground mb-2 text-[13px] font-bold tracking-wide uppercase">
                Quick Tips
              </h4>
              <div className="text-muted-foreground space-y-2 text-[14px]">
                <p className="flex items-start gap-2">
                  <Sparkles className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                  Start broad, then fine-tune after interacting with your feed.
                </p>
                <p className="flex items-start gap-2">
                  <FileText className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                  Upload PDFs to ground results in your own sources.
                </p>
              </div>
            </div>
          </div>
        </aside>
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
