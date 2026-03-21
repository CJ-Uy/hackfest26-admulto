"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Loader2,
  X,
  ChevronDown,
  Zap,
  Brain,
  Info,
} from "lucide-react";
import { GenerationProgress } from "./GenerationProgress";
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

interface OllamaModel {
  name: string;
  size: number;
  parameterSize?: string;
  family?: string;
}

interface TopicFormProps {
  mode: "brainstorm" | "citationFinder" | null;
  initialTopic?: string;
}

function formatSize(bytes: number): string {
  const gb = bytes / 1e9;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${(bytes / 1e6).toFixed(0)} MB`;
}


export function TopicForm({ mode, initialTopic }: TopicFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [scrollId, setScrollId] = useState<string | null>(null);
  const [submittedTopic, setSubmittedTopic] = useState("");
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

  // Advanced settings
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [fastModel, setFastModel] = useState("");
  const [smartModel, setSmartModel] = useState("");
  const [modelsLoaded, setModelsLoaded] = useState(false);

  useEffect(() => {
    if (advancedOpen && !modelsLoaded) {
      fetch("/api/ollama-models")
        .then((r) => r.json())
        .then((data: unknown) => {
          const typedData = data as { models: OllamaModel[] };
          setModels(typedData.models);
          setModelsLoaded(true);
        })
        .catch(() => setModelsLoaded(true));
    }
  }, [advancedOpen, modelsLoaded]);

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

    setSubmittedTopic(topic);
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
          fastModel: fastModel || undefined,
          smartModel: smartModel || undefined,
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

  if (loading) {
    return (
      <GenerationProgress
        progress={progress}
        topic={submittedTopic || "your topic"}
      />
    );
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

      {/* Advanced Settings */}
      <div className="border-border rounded-lg border">
        <button
          type="button"
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between px-4 py-3 text-sm font-medium transition-colors"
        >
          <span className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5" />
            Advanced Settings
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${
              advancedOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {advancedOpen && (
          <div className="border-border space-y-4 border-t px-4 py-4">
            {/* Info banner */}
            <div className="bg-muted/50 flex items-start gap-2 rounded-md p-3">
              <Info className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p className="text-muted-foreground text-xs leading-relaxed">
                Choose which Ollama models to use. <strong>Fast model</strong>{" "}
                handles paper summaries (many calls, speed matters).{" "}
                <strong>Smart model</strong> handles comments and outlines
                (fewer calls, quality matters).
              </p>
            </div>

            {models.length === 0 && !modelsLoaded && (
              <div className="flex items-center justify-center gap-2 py-4">
                <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                <span className="text-muted-foreground text-sm">
                  Loading models from Ollama...
                </span>
              </div>
            )}

            {models.length === 0 && modelsLoaded && (
              <p className="text-muted-foreground py-2 text-center text-sm">
                Could not connect to Ollama. Make sure it&apos;s running on{" "}
                <code className="bg-muted rounded px-1 text-xs">
                  localhost:11434
                </code>
              </p>
            )}

            {models.length > 0 && (
              <>
                {/* Fast Model */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    Fast Model
                    <span className="text-muted-foreground text-xs font-normal">
                      (summaries & citations)
                    </span>
                  </label>
                  <select
                    value={fastModel}
                    onChange={(e) => setFastModel(e.target.value)}
                    disabled={loading}
                    className="border-border bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="">Default (phi4-mini:3.8b)</option>
                    {models.map((m) => (
                      <option key={`fast-${m.name}`} value={m.name}>
                        {m.name} ({formatSize(m.size)}
                        {m.parameterSize ? ` · ${m.parameterSize}` : ""})
                      </option>
                    ))}
                  </select>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Smaller = faster. Called 12+ times per feed.
                  </p>
                </div>

                {/* Smart Model */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
                    <Brain className="h-3.5 w-3.5 text-purple-500" />
                    Smart Model
                    <span className="text-muted-foreground text-xs font-normal">
                      (comments & outlines)
                    </span>
                  </label>
                  <select
                    value={smartModel}
                    onChange={(e) => setSmartModel(e.target.value)}
                    disabled={loading}
                    className="border-border bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="">Default (llama3:8b)</option>
                    {models.map((m) => (
                      <option key={`smart-${m.name}`} value={m.name}>
                        {m.name} ({formatSize(m.size)}
                        {m.parameterSize ? ` · ${m.parameterSize}` : ""})
                      </option>
                    ))}
                  </select>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Bigger = better quality. Called 12 times per feed.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full gap-2"
        disabled={loading || !mode}
      >
        <Sparkles className="h-4 w-4" />
        Generate My Feed
      </Button>

      {!mode && (
        <p className="text-muted-foreground text-center text-xs">
          Select a mode above to enable feed generation.
        </p>
      )}
    </form>
  );
}
