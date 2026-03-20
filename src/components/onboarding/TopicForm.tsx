"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { OnboardingPreset, ScrollSession } from "@/lib/types";

interface TopicFormProps {
  preset: OnboardingPreset | null;
  mode: "brainstorm" | "citationFinder" | null;
}

export function TopicForm({ preset, mode }: TopicFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const topicRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const topic = topicRef.current?.value?.trim();
    if (!topic) return;

    setLoading(true);

    try {
      const res = await fetch("/api/generate-feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          description: descRef.current?.value?.trim() || undefined,
          subfields: preset?.subfields || undefined,
          mode: mode || "brainstorm",
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error || `API returned ${res.status}`);
      }

      const data = (await res.json()) as {
        scroll: ScrollSession;
      };

      router.push(`/scroll/${data.scroll.id}`);
    } catch (err) {
      console.error("Feed generation failed:", err);
      toast.error(
        "Could not generate feed. Using demo data instead."
      );
      // Fallback: navigate to the demo scroll
      router.push("/scroll/1");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="topic" className="mb-1.5 block text-sm font-medium">
          Main Topic <span className="text-destructive">*</span>
        </label>
        <Input
          id="topic"
          ref={topicRef}
          placeholder="e.g., Cognitive Psychology and Decision-Making"
          defaultValue={preset?.topic ?? ""}
          key={preset?.topic ?? "empty"}
          required
          disabled={loading}
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="mb-1.5 block text-sm font-medium"
        >
          Description{" "}
          <span className="text-xs text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          id="description"
          ref={descRef}
          placeholder="Add context about your research direction..."
          defaultValue={preset?.description ?? ""}
          key={preset?.description ?? "empty"}
          rows={3}
          className="resize-none"
          disabled={loading}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">
          Subfields / Interests{" "}
          <span className="text-xs text-muted-foreground">(optional)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {preset?.subfields.map((sf) => (
            <Badge key={sf} variant="secondary">
              {sf}
            </Badge>
          ))}
          {!preset && (
            <p className="text-xs text-muted-foreground">
              Select a mode above to auto-populate subfields.
            </p>
          )}
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full gap-2"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating your feed...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate My Feed
          </>
        )}
      </Button>

      {loading && (
        <p className="text-center text-xs text-muted-foreground">
          Searching papers, generating summaries, and verifying claims. This may
          take a minute.
        </p>
      )}
    </form>
  );
}
