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
  Clock,
  FileUp,
} from "lucide-react";
import { GenerationProgress } from "./GenerationProgress";
import { PdfUploader, type UploadedFile } from "./PdfUploader";
import { PdfVerification } from "./PdfVerification";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

type SourceMode = "include" | "context_only" | "only_sources";

interface TopicFormProps {
  initialTopic?: string;
}

function formatSize(bytes: number): string {
  const gb = bytes / 1e9;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${(bytes / 1e6).toFixed(0)} MB`;
}

function estimateGenerationTime(params: {
  pdfCount: number;
  sourceMode: SourceMode;
  fastModel: string;
  smartModel: string;
  models: OllamaModel[];
}): { min: number; max: number } {
  const { pdfCount, sourceMode, fastModel, smartModel, models } = params;

  function getModelMultiplier(modelName: string): number {
    if (!modelName) return 1;
    const model = models.find((m) => m.name === modelName);
    if (!model) return 1;
    const sizeGB = model.size / 1e9;
    if (sizeGB > 10) return 2.5;
    if (sizeGB > 5) return 1.8;
    if (sizeGB > 2) return 1.2;
    return 1;
  }

  let baseSeconds = 0;

  // PDF extraction
  baseSeconds += pdfCount * 5;

  // Academic search (skip if only_sources)
  if (sourceMode !== "only_sources") {
    baseSeconds += 15;
  }

  // Paper count estimate
  const paperCount =
    sourceMode === "only_sources" ? pdfCount : Math.min(12, pdfCount + 12);

  // Per-paper synthesis
  const fastMult = getModelMultiplier(fastModel);
  baseSeconds += paperCount * 8 * fastMult;

  // Comments + outline
  const smartMult = getModelMultiplier(smartModel);
  baseSeconds += 30 * smartMult;
  baseSeconds += 15 * smartMult;

  return {
    min: Math.max(1, Math.floor(baseSeconds / 60)),
    max: Math.ceil((baseSeconds * 1.5) / 60),
  };
}

export function TopicForm({ initialTopic }: TopicFormProps) {
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

  // PDF upload state
  const [pdfEnabled, setPdfEnabled] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [sourceMode, setSourceMode] = useState<SourceMode>("include");
  // PDF verification state
  const [showVerification, setShowVerification] = useState(false);

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
          router.push(`/schroll/${scrollId}`);
        } else if (data.status === "error") {
          stopPolling();
          setLoading(false);
          setScrollId(null);
          toast.error(
            data.progress?.message ||
              "Feed generation failed. Please try again.",
          );
        } else {
          setProgress(data.progress);
        }
      } catch {
        // Ignore transient fetch errors during polling
      }
    }

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

  const doneFiles = uploadedFiles.filter((f) => f.status === "done");
  const isOnlySourcesMode = pdfEnabled && sourceMode === "only_sources";
  const topicRequired = !isOnlySourcesMode;

  const estimate = estimateGenerationTime({
    pdfCount: doneFiles.length,
    sourceMode: pdfEnabled ? sourceMode : "include",
    fastModel,
    smartModel,
    models,
  });

  function proceedToGenerate() {
    const topic = topicRef.current?.value?.trim();
    setSubmittedTopic(topic || "your uploaded sources");
    setLoading(true);
    setProgress({ step: pdfEnabled ? "extracting" : "searching" });
    doGenerate(topic);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const topic = topicRef.current?.value?.trim();

    if (topicRequired && !topic) {
      toast.error("Please enter a topic.");
      return;
    }

    if (pdfEnabled && doneFiles.length === 0) {
      toast.error("Please upload at least one PDF or disable PDF sources.");
      return;
    }

    // Show verification step if PDFs are uploaded
    if (pdfEnabled && doneFiles.length > 0 && !showVerification) {
      setShowVerification(true);
      return;
    }

    proceedToGenerate();
  }

  async function doGenerate(topic: string | undefined) {

    try {
      const pdfKeys = pdfEnabled ? doneFiles.map((f) => f.key) : undefined;

      const res = await fetch("/api/generate-feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic || undefined,
          description: descRef.current?.value?.trim() || undefined,
          subfields: subfields.length > 0 ? subfields : undefined,
          fastModel: fastModel || undefined,
          smartModel: smartModel || undefined,
          pdfKeys,
          sourceMode: pdfEnabled ? sourceMode : undefined,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error || `API returned ${res.status}`);
      }

      const data = (await res.json()) as {
        scroll: { id: string };
      };

      setScrollId(data.scroll.id);
    } catch (err) {
      console.error("Feed generation failed:", err);
      toast.error("Could not generate feed. Please try again.");
      setLoading(false);
      setProgress(null);
    }
  }

  if (showVerification && !loading) {
    return (
      <div className="mt-8">
        <h2 className="text-foreground mb-1 text-lg font-bold">
          Verify Paper Understanding
        </h2>
        <p className="text-muted-foreground mb-4 text-sm">
          Answer a few questions to confirm the system understood your papers
          correctly.
        </p>
        <PdfVerification
          pdfKeys={doneFiles.map((f) => f.key)}
          pdfFilenames={doneFiles.map((f) => f.filename)}
          onComplete={() => {
            proceedToGenerate();
          }}
          onSkip={() => {
            proceedToGenerate();
          }}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <GenerationProgress
        progress={progress}
        topic={submittedTopic || "your topic"}
        hasPdfs={pdfEnabled && doneFiles.length > 0}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      {/* ── PDF Sources ── */}
      <div className="border-border space-y-4 rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <FileUp className="text-primary h-4 w-4" />
            Upload your own PDF sources
          </label>
          <Switch checked={pdfEnabled} onCheckedChange={setPdfEnabled} />
        </div>

        {pdfEnabled && (
          <>
            <PdfUploader
              files={uploadedFiles}
              onFilesChange={setUploadedFiles}
              disabled={loading}
            />

            {doneFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm font-medium">
                  How should your sources be used?
                </p>
                <div className="space-y-2">
                  {(
                    [
                      {
                        value: "include",
                        label: "Include as posts in the feed",
                        desc: "Your PDFs appear alongside discovered papers",
                      },
                      {
                        value: "context_only",
                        label: "Use as context only",
                        desc: "Inform the search but don't show as posts",
                      },
                      {
                        value: "only_sources",
                        label: "Only use your sources",
                        desc: "No external search — self-contained feed",
                      },
                    ] as const
                  ).map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                        sourceMode === opt.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="sourceMode"
                        value={opt.value}
                        checked={sourceMode === opt.value}
                        onChange={() => setSourceMode(opt.value)}
                        className="accent-primary mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-muted-foreground text-xs">
                          {opt.desc}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Topic / Description ── */}
      <div>
        <label htmlFor="topic" className="mb-1.5 block text-sm font-medium">
          Main Topic{" "}
          {topicRequired ? (
            <span className="text-destructive">*</span>
          ) : (
            <span className="text-muted-foreground text-xs">
              (optional — auto-derived from PDFs)
            </span>
          )}
        </label>
        <Input
          id="topic"
          ref={topicRef}
          defaultValue={initialTopic}
          placeholder="e.g., Cognitive Psychology and Decision-Making"
          required={topicRequired}
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
          placeholder="Add context about your research direction..."
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

      {/* ── Advanced Settings ── */}
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

      {/* ── Estimated Time ── */}
      <div className="bg-muted/50 flex items-center gap-2 rounded-lg px-4 py-3">
        <Clock className="text-muted-foreground h-4 w-4 shrink-0" />
        <p className="text-muted-foreground text-sm">
          Estimated time:{" "}
          <span className="text-foreground font-medium">
            {estimate.min === estimate.max
              ? `~${estimate.min} min`
              : `${estimate.min}–${estimate.max} min`}
          </span>
          {pdfEnabled && doneFiles.length > 0 && (
            <span className="ml-2 text-xs">
              ({doneFiles.length} PDF{doneFiles.length !== 1 ? "s" : ""}
              {sourceMode === "only_sources" ? ", no external search" : ""})
            </span>
          )}
        </p>
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full gap-2"
        disabled={loading}
      >
        <Sparkles className="h-4 w-4" />
        Generate My Feed
      </Button>
    </form>
  );
}
