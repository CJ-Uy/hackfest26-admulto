"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ProgressInfo {
  step: string;
  papersProcessed?: number;
  total?: number;
  message?: string;
}

interface TopicFormProps {
  mode: "brainstorm" | "citationFinder" | null;
  initialTopic?: string;
}

function getProgressMessage(progress: ProgressInfo | null): string {
  if (!progress) return "Starting...";
  switch (progress.step) {
    case "searching":
      return "Searching for papers...";
    case "processing":
      if (progress.total && progress.total > 0) {
        return `Generating summaries... ${progress.papersProcessed ?? 0}/${progress.total}`;
      }
      return "Generating summaries...";
    case "exporting":
      return "Organizing your research...";
    case "error":
      return progress.message || "Something went wrong.";
    default:
      return "Working...";
  }
}

function getProgressPercent(progress: ProgressInfo | null): number {
  if (!progress) return 5;
  switch (progress.step) {
    case "searching":
      return 15;
    case "processing": {
      const base = 20;
      const range = 60;
      if (progress.total && progress.total > 0) {
        return base + (range * (progress.papersProcessed ?? 0)) / progress.total;
      }
      return base;
    }
    case "exporting":
      return 85;
    default:
      return 5;
  }
}

export function TopicForm({ mode, initialTopic }: TopicFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [scrollId, setScrollId] = useState<string | null>(null);
  const [subfields, setSubfields] = useState<string[]>([]);
  const [subfieldInput, setSubfieldInput] = useState("");
  const topicRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Poll for status updates
  useEffect(() => {
    if (!scrollId) return;

    async function pollStatus() {
      try {
        const res = await fetch(`/api/scrolls/${scrollId}/status`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          status: string;
          progress: ProgressInfo | null;
        };

        if (data.status === "complete") {
          stopPolling();
          router.push(`/scroll/${scrollId}`);
        } else if (data.status === "error") {
          stopPolling();
          setLoading(false);
          setScrollId(null);
          toast.error(
            data.progress?.message || "Feed generation failed. Please try again.",
          );
        } else {
          setProgress(data.progress);
        }
      } catch {
        // Ignore transient fetch errors during polling
      }
    }

    // Poll immediately, then every 2.5s
    pollStatus();
    pollingRef.current = setInterval(pollStatus, 2500);

    return stopPolling;
  }, [scrollId, router, stopPolling]);

  function addSubfield() {
    const val = subfieldInput.trim();
    if (val && !subfields.includes(val)) {
      setSubfields([...subfields, val]);
      setSubfieldInput("");
    }
  }

  function removeSubfield(sf: string) {
    setSubfields(subfields.filter((s) => s !== sf));
  }

  function handleSubfieldKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addSubfield();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!mode) {
      toast.error("Please select a mode first.");
      return;
    }

    const topic = topicRef.current?.value?.trim();
    if (!topic) return;

    setLoading(true);
    setProgress({ step: "searching" });

    try {
      const res = await fetch("/api/generate-feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          description: descRef.current?.value?.trim() || undefined,
          subfields: subfields.length > 0 ? subfields : undefined,
          mode: mode || "brainstorm",
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error || `API returned ${res.status}`);
      }

      const data = (await res.json()) as {
        scroll: { id: string };
      };

      // Start polling for progress
      setScrollId(data.scroll.id);
    } catch (err) {
      console.error("Feed generation failed:", err);
      toast.error("Could not generate feed. Please try again.");
      setLoading(false);
      setProgress(null);
    }
  }

  const progressPercent = getProgressPercent(progress);

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="topic" className="mb-1.5 block text-sm font-medium">
          Main Topic <span className="text-destructive">*</span>
        </label>
        <Input
          id="topic"
          ref={topicRef}
          defaultValue={initialTopic}
          placeholder={
            mode === "citationFinder"
              ? "e.g., Climate Policy Effectiveness in Southeast Asia"
              : "e.g., Cognitive Psychology and Decision-Making"
          }
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
          <span className="text-muted-foreground text-xs">(optional)</span>
        </label>
        <Textarea
          id="description"
          ref={descRef}
          placeholder={
            mode === "citationFinder"
              ? "Describe the paper you're writing and what citations you need..."
              : "Add context about your research direction..."
          }
          rows={3}
          className="resize-none"
          disabled={loading}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">
          Subfields / Interests{" "}
          <span className="text-muted-foreground text-xs">(optional)</span>
        </label>
        <div className="flex gap-2">
          <Input
            value={subfieldInput}
            onChange={(e) => setSubfieldInput(e.target.value)}
            onKeyDown={handleSubfieldKeyDown}
            placeholder="Type a subfield and press Enter"
            disabled={loading}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addSubfield}
            disabled={loading || !subfieldInput.trim()}
          >
            Add
          </Button>
        </div>
        {subfields.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {subfields.map((sf) => (
              <Badge key={sf} variant="secondary" className="gap-1 pr-1.5">
                {sf}
                <button
                  type="button"
                  onClick={() => removeSubfield(sf)}
                  className="hover:bg-muted ml-0.5 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        {subfields.length === 0 && (
          <p className="text-muted-foreground mt-1.5 text-xs">
            Add subfields to narrow your research focus.
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full gap-2"
        disabled={loading || !mode}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {getProgressMessage(progress)}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate My Feed
          </>
        )}
      </Button>

      {!mode && (
        <p className="text-muted-foreground text-center text-xs">
          Select a mode above to enable feed generation.
        </p>
      )}

      {loading && (
        <div className="space-y-2">
          <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-muted-foreground text-center text-xs">
            {getProgressMessage(progress)}
          </p>
        </div>
      )}
    </form>
  );
}
