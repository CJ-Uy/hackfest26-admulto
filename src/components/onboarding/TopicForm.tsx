"use client";

import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { OnboardingPreset } from "@/lib/types";

interface TopicFormProps {
  preset: OnboardingPreset | null;
}

export function TopicForm({ preset }: TopicFormProps) {
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push("/scroll/1");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div>
        <label
          htmlFor="topic"
          className="mb-1.5 block text-sm font-medium"
        >
          Main Topic <span className="text-destructive">*</span>
        </label>
        <Input
          id="topic"
          placeholder="e.g., Cognitive Psychology and Decision-Making"
          defaultValue={preset?.topic ?? ""}
          key={preset?.topic ?? "empty"}
          required
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
          placeholder="Add context about your research direction..."
          defaultValue={preset?.description ?? ""}
          key={preset?.description ?? "empty"}
          rows={3}
          className="resize-none"
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

      <Button type="submit" size="lg" className="w-full gap-2">
        <Sparkles className="h-4 w-4" />
        Generate My Feed
      </Button>
    </form>
  );
}
