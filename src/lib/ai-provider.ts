/**
 * AI Provider abstraction — supports Ollama (default) and Cloudflare Workers AI (fallback).
 *
 * The active provider is set per-request via setProvider().
 * Cloudflare AI uses the AI binding from wrangler.jsonc.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export type AiProviderType = "ollama" | "cloudflare";

let currentProvider: AiProviderType = "ollama";
let currentOllamaUrl: string =
  process.env.OLLAMA_URL || "http://localhost:11434";

// CF AI model mapping — use models available on free tier
const CF_FAST_MODEL = "@cf/microsoft/phi-2";
const CF_SMART_MODEL = "@cf/meta/llama-3.1-8b-instruct";

// Neuron cost estimates per call (input + output)
const NEURON_COST = {
  fast: 80, // ~150 input tokens + ~100 output tokens on phi-2
  smart: 200, // ~300 input tokens + ~100 output tokens on llama-3.1-8b
} as const;

const DAILY_NEURON_LIMIT = 10_000;

// In-memory neuron tracker (resets when worker restarts, but good enough for estimates)
let neuronUsage = { date: "", used: 0 };

function getTodayUTC(): string {
  return new Date().toISOString().split("T")[0];
}

function trackNeurons(tier: "fast" | "smart") {
  const today = getTodayUTC();
  if (neuronUsage.date !== today) {
    neuronUsage = { date: today, used: 0 };
  }
  neuronUsage.used += NEURON_COST[tier];
}

/** Returns estimated neuron usage and limit for today. */
export function getNeuronBudget(): {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
} {
  const today = getTodayUTC();
  if (neuronUsage.date !== today) {
    neuronUsage = { date: today, used: 0 };
  }
  // Next reset is midnight UTC
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);

  return {
    used: neuronUsage.used,
    limit: DAILY_NEURON_LIMIT,
    remaining: Math.max(0, DAILY_NEURON_LIMIT - neuronUsage.used),
    resetsAt: tomorrow.toISOString(),
  };
}

export function setProvider(provider: AiProviderType, ollamaUrl?: string) {
  currentProvider = provider;
  if (ollamaUrl) currentOllamaUrl = ollamaUrl;
}

export function getProvider(): AiProviderType {
  return currentProvider;
}

export function getOllamaUrl(): string {
  return currentOllamaUrl;
}

/**
 * Call Cloudflare Workers AI via the binding.
 */
async function cloudflareAiChat(
  systemPrompt: string,
  userPrompt: string,
  _model: "fast" | "smart",
): Promise<string> {
  const modelId = _model === "fast" ? CF_FAST_MODEL : CF_SMART_MODEL;

  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext();
    const ai = (ctx.env as { AI?: AnyRecord }).AI;

    if (!ai) {
      throw new Error("AI binding not available");
    }

    const result = (await ai.run(modelId, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 512,
      temperature: 0.7,
    })) as { response?: string };

    trackNeurons(_model);
    return result.response || "";
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // Error 4006 = daily free neuron limit exceeded
    if (errMsg.includes("4006") || errMsg.includes("neuron")) {
      // Mark as fully used so the UI can show the limit
      const today = getTodayUTC();
      neuronUsage = { date: today, used: DAILY_NEURON_LIMIT };
      const budget = getNeuronBudget();
      throw new Error(
        `Cloudflare AI daily limit reached. Resets at ${budget.resetsAt}`,
      );
    }
    console.error(`[cloudflareAi] Failed with model ${modelId}:`, err);
    throw err;
  }
}

/**
 * Call Ollama via streaming HTTP API.
 */
async function ollamaChat(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  retries: number = 3,
): Promise<string> {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const res = await fetch(`${currentOllamaUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: true,
          options: {
            num_predict: 256,
            temperature: 0.7,
          },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!res.ok) {
        if (res.status === 429 && attempt < retries) {
          attempt++;
          const retryAfter = res.headers.get("Retry-After");
          const delay = retryAfter
            ? parseInt(retryAfter) * 1000
            : Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          console.warn(
            `[ollamaChat] Rate limited (429), retrying in ${delay}ms (attempt ${attempt}/${retries})`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(`Ollama request failed: ${res.status}`);
      }

      // Read streaming NDJSON response
      const reader = res.body?.getReader();
      if (!reader) return "";

      const decoder = new TextDecoder();
      let content = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const chunk = JSON.parse(trimmed) as AnyRecord;
            if (chunk.message?.content) {
              content += chunk.message.content;
            }
          } catch {
            // Skip malformed lines
          }
        }
      }

      if (buffer.trim()) {
        try {
          const chunk = JSON.parse(buffer.trim()) as AnyRecord;
          if (chunk.message?.content) {
            content += chunk.message.content;
          }
        } catch {
          // Skip
        }
      }

      return content;
    } catch (err) {
      if (attempt >= retries) throw err;
      attempt++;
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
      console.warn(
        `[ollamaChat] Request failed (${(err as Error).message}), retrying in ${delay}ms (attempt ${attempt}/${retries})`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return "";
}

/**
 * Unified chat function — routes to Ollama or Cloudflare AI based on current provider.
 * If Ollama fails and provider is "ollama", does NOT fallback to CF (user chose Ollama explicitly).
 * If provider is "cloudflare", uses CF AI directly.
 */
export async function aiChat(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  tier: "fast" | "smart" = "fast",
): Promise<string> {
  if (currentProvider === "cloudflare") {
    return cloudflareAiChat(systemPrompt, userPrompt, tier);
  }

  // Ollama with CF AI fallback
  try {
    return await ollamaChat(systemPrompt, userPrompt, model);
  } catch (err) {
    console.warn(
      `[aiChat] Ollama failed, falling back to Cloudflare AI:`,
      (err as Error).message,
    );
    try {
      return await cloudflareAiChat(systemPrompt, userPrompt, tier);
    } catch (cfErr) {
      console.error(`[aiChat] Cloudflare AI fallback also failed:`, cfErr);
      throw err; // throw the original Ollama error
    }
  }
}
