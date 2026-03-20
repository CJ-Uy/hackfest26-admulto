"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface TopicFormProps {
  mode: "brainstorm" | "citationFinder" | null;
}

export function TopicForm({ mode }: TopicFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [subfields, setSubfields] = useState<string[]>([]);
  const [subfieldInput, setSubfieldInput] = useState("");
  const topicRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

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

      router.push(`/scroll/${data.scroll.id}`);
    } catch (err) {
      console.error("Feed generation failed:", err);
      toast.error("Could not generate feed. Please try again.");
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
          <span className="text-xs text-muted-foreground">(optional)</span>
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
          <span className="text-xs text-muted-foreground">(optional)</span>
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
              <Badge
                key={sf}
                variant="secondary"
                className="gap-1 pr-1.5"
              >
                {sf}
                <button
                  type="button"
                  onClick={() => removeSubfield(sf)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        {subfields.length === 0 && (
          <p className="mt-1.5 text-xs text-muted-foreground">
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
            Generating your feed...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate My Feed
          </>
        )}
      </Button>

      {!mode && (
        <p className="text-center text-xs text-muted-foreground">
          Select a mode above to enable feed generation.
        </p>
      )}

      {loading && (
        <p className="text-center text-xs text-muted-foreground">
          Searching papers, generating summaries, and verifying claims. This may
          take a minute.
        </p>
      )}
    </form>
  );
}
