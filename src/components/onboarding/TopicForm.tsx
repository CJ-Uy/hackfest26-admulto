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
  AlertTriangle,
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
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Drive paper-by-paper processing via process-next endpoint.
  // Each call processes ONE paper and returns progress.
  // Sequential: next call only fires after the previous completes.
  useEffect(() => {
    if (!scrollId) return;
    let cancelled = false;

    async function driveProcessing() {
      while (!cancelled) {
        try {
          const res = await fetch("/api/generate-feed/process-next", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scrollId }),
          });

          if (!res.ok) {
            // Server error — wait and retry
            await new Promise((r) => {
              pollingRef.current = setTimeout(r, 3000);
            });
            continue;
          }

          const data = (await res.json()) as {
            status: string;
            progress: ProgressInfo | null;
            done?: boolean;
          };

          if (cancelled) break;

          if (data.status === "complete" || data.done) {
            router.push(`/schroll/${scrollId}`);
            return;
          }

          if (data.status === "error") {
            setLoading(false);
            setScrollId(null);
            toast.error(
              data.progress?.message ||
                "Feed generation failed. Please try again.",
            );
            return;
          }

          setProgress(data.progress);
        } catch {
          // Transient network error — wait and retry
          if (cancelled) break;
          await new Promise((r) => {
            pollingRef.current = setTimeout(r, 3000);
          });
          continue;
        }

        // Gap between requests to stay within Turso free-tier rate limits
        if (!cancelled) {
          await new Promise((r) => {
            pollingRef.current = setTimeout(r, 2000);
          });
        }
      }
    }

    driveProcessing();
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [scrollId, router, stopPolling]);

  // Advanced settings
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [fastModel, setFastModel] = useState("");
  const [smartModel, setSmartModel] = useState("");
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [provider, setProvider] = useState<"ollama" | "cloudflare">("ollama");
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [ollamaStatus, setOllamaStatus] = useState<
    "checking" | "online" | "offline" | null
  >(null);
  const [neuronBudget, setNeuronBudget] = useState<{
    used: number;
    limit: number;
    remaining: number;
    resetsAt: string;
  } | null>(null);

  // Fetch CF AI neuron budget when cloudflare provider is selected
  useEffect(() => {
    if (!advancedOpen || provider !== "cloudflare") {
      setNeuronBudget(null);
      return;
    }
    fetch("/api/ai-budget")
      .then((r) => r.json())
      .then((data: unknown) =>
        setNeuronBudget(
          data as {
            used: number;
            limit: number;
            remaining: number;
            resetsAt: string;
          },
        ),
      )
      .catch(() => setNeuronBudget(null));
  }, [advancedOpen, provider]);

  // Check Ollama connectivity when advanced opens or URL changes
  useEffect(() => {
    if (!advancedOpen || provider !== "ollama") return;

    const url = ollamaUrl || undefined;
    setOllamaStatus("checking");
    setModelsLoaded(false);

    const fetchUrl = url
      ? `/api/ollama-models?url=${encodeURIComponent(url)}`
      : "/api/ollama-models";

    fetch(fetchUrl)
      .then((r) => r.json())
      .then((data: unknown) => {
        const typedData = data as { models: OllamaModel[] };
        setModels(typedData.models);
        setModelsLoaded(true);
        setOllamaStatus(typedData.models.length > 0 ? "online" : "offline");
      })
      .catch(() => {
        setModelsLoaded(true);
        setOllamaStatus("offline");
      });
  }, [advancedOpen, provider, ollamaUrl]);

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
          provider: provider || undefined,
          ollamaUrl: provider === "ollama" && ollamaUrl ? ollamaUrl : undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `API returned ${res.status}`);
      }

      const data = (await res.json()) as { scroll: { id: string } };
      if (!data.scroll?.id) throw new Error("No scroll ID received");
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
      {/* ── PDF Sources ──
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
      </div> */}

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
          placeholder="e.g., Cognitive Psychology"
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
            {/* AI Provider Selection */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
                <Brain className="h-3.5 w-3.5 text-blue-500" />
                AI Provider
              </label>
              <div className="space-y-2">
                {(
                  [
                    {
                      value: "ollama" as const,
                      label: "Ollama (Self-hosted)",
                      desc: "Use your own Ollama instance — faster, no token limits",
                    },
                    {
                      value: "cloudflare" as const,
                      label: "Cloudflare AI (Free tier)",
                      desc: "Uses Cloudflare Workers AI — 10,000 neurons/day free",
                    },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                      provider === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="provider"
                      value={opt.value}
                      checked={provider === opt.value}
                      onChange={() => setProvider(opt.value)}
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

            {/* Ollama URL + Model Selection */}
            {provider === "ollama" && (
              <>
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
                    Ollama URL
                    {ollamaStatus === "checking" && (
                      <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                    )}
                    {ollamaStatus === "online" && (
                      <span className="text-xs font-normal text-green-600">
                        Connected
                      </span>
                    )}
                    {ollamaStatus === "offline" && (
                      <span className="text-xs font-normal text-red-500">
                        Unreachable
                      </span>
                    )}
                  </label>
                  <Input
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    placeholder="Default: ollama.cjuy.dev (leave empty)"
                    disabled={loading}
                  />
                  <p className="text-muted-foreground mt-1 text-xs">
                    Leave empty to use the default server. Enter your own Ollama
                    URL if self-hosting.
                  </p>
                </div>

                {/* Info banner */}
                <div className="bg-muted/50 flex items-start gap-2 rounded-md p-3">
                  <Info className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Choose which Ollama models to use.{" "}
                    <strong>Fast model</strong> handles paper summaries (many
                    calls, speed matters). <strong>Smart model</strong> handles
                    comments and outlines (fewer calls, quality matters).
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
                    Could not connect to Ollama. Try a different URL or switch
                    to Cloudflare AI.
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
              </>
            )}

            {/* Cloudflare AI info + budget */}
            {provider === "cloudflare" && (
              <>
                <div className="bg-muted/50 flex items-start gap-2 rounded-md p-3">
                  <Info className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div className="text-muted-foreground space-y-1.5 text-xs leading-relaxed">
                    <p>
                      Cloudflare AI uses <strong>Llama 3.1 8B</strong> and{" "}
                      <strong>Phi-2</strong> on the free tier. Each feed
                      generation uses ~3,500–4,000 neurons. Free tier allows
                      10,000 neurons/day (~2–3 feeds).
                    </p>
                    <p className="font-medium text-amber-600">
                      Due to daily neuron limits, Cloudflare AI will only
                      generate the feed — AI-generated comments and replies will
                      be disabled. For the full experience with comments,
                      contact <strong>Charles Joshua Uy</strong> to turn on an
                      Ollama dev instance for demo.
                    </p>
                  </div>
                </div>

                {neuronBudget && (
                  <div className="border-border rounded-lg border p-3">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">
                        Daily Neuron Budget
                      </span>
                      <span
                        className={`font-bold ${
                          neuronBudget.remaining < 2000
                            ? "text-red-500"
                            : neuronBudget.remaining < 5000
                              ? "text-amber-500"
                              : "text-green-600"
                        }`}
                      >
                        {neuronBudget.remaining.toLocaleString()} remaining
                      </span>
                    </div>
                    <div className="bg-muted h-2 overflow-hidden rounded-full">
                      <div
                        className={`h-full rounded-full transition-all ${
                          neuronBudget.remaining < 2000
                            ? "bg-red-500"
                            : neuronBudget.remaining < 5000
                              ? "bg-amber-500"
                              : "bg-green-600"
                        }`}
                        style={{
                          width: `${Math.max(2, (neuronBudget.remaining / neuronBudget.limit) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        {neuronBudget.used.toLocaleString()} /{" "}
                        {neuronBudget.limit.toLocaleString()} used
                      </span>
                      <span className="text-muted-foreground">
                        Resets{" "}
                        {new Date(neuronBudget.resetsAt).toLocaleTimeString(
                          [],
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                      </span>
                    </div>
                    {neuronBudget.remaining < 2000 && (
                      <p className="mt-2 text-xs font-medium text-red-500">
                        Not enough neurons for a full feed. Try again after the
                        reset or switch to Ollama.
                      </p>
                    )}
                  </div>
                )}
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

      <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2.5 sm:px-4 sm:py-3">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-amber-900 sm:text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Heads up: generating a schroll may be buggy in production due to
            Cloudflare Workers free-tier CPU timeouts and limits.
          </span>
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
