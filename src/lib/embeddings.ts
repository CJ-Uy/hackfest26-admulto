/**
 * Embedding utilities using nomic-embed-text via Ollama.
 * Used for semantic similarity ranking, deduplication, and search.
 */

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const EMBED_MODEL = "nomic-embed-text";

/**
 * Embed a single text string. Returns a 768-dimensional float array.
 */
export async function embed(text: string): Promise<number[]> {
  const truncated = text.slice(0, 8000);
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: truncated }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`Embedding request failed: ${res.status}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as Record<string, any>;
  const embeddings = data.embeddings as number[][];
  if (!embeddings || embeddings.length === 0) {
    throw new Error("No embeddings returned from Ollama");
  }
  return embeddings[0];
}

/**
 * Embed multiple texts in a single request. Returns parallel array of embeddings.
 * Processes in chunks of 10 to avoid memory issues.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const CHUNK_SIZE = 10;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
    const chunk = texts.slice(i, i + CHUNK_SIZE).map((t) => t.slice(0, 8000));

    const res = await fetch(`${OLLAMA_URL}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL, input: chunk }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      throw new Error(`Batch embedding request failed: ${res.status}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as Record<string, any>;
    const embeddings = data.embeddings as number[][];
    if (!embeddings) {
      throw new Error("No embeddings returned from Ollama");
    }
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}

/**
 * Compute cosine similarity between two vectors. Returns value in [-1, 1].
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;
  return dot / denom;
}

/**
 * Rank candidates by cosine similarity to a query embedding.
 * Returns sorted array of { index, score } in descending similarity order.
 */
export function rankBySimilarity(
  queryEmbedding: number[],
  candidateEmbeddings: number[][],
  topK?: number,
): Array<{ index: number; score: number }> {
  const scores = candidateEmbeddings.map((emb, index) => ({
    index,
    score: cosineSimilarity(queryEmbedding, emb),
  }));
  scores.sort((a, b) => b.score - a.score);
  return topK ? scores.slice(0, topK) : scores;
}

/**
 * Find the most semantically similar items for each item in a list.
 * Returns a map from index -> sorted array of { index, score } for other items.
 */
export function findSimilarPairs(
  embeddings: number[][],
  topK = 4,
): Map<number, Array<{ index: number; score: number }>> {
  const pairs = new Map<number, Array<{ index: number; score: number }>>();

  for (let i = 0; i < embeddings.length; i++) {
    const scores: Array<{ index: number; score: number }> = [];
    for (let j = 0; j < embeddings.length; j++) {
      if (i === j) continue;
      scores.push({
        index: j,
        score: cosineSimilarity(embeddings[i], embeddings[j]),
      });
    }
    scores.sort((a, b) => b.score - a.score);
    pairs.set(i, scores.slice(0, topK));
  }

  return pairs;
}

/**
 * Deduplicate items by embedding similarity.
 * Returns indices to keep (removes near-duplicates above threshold).
 * When duplicates are found, keeps the one selected by the preferIndex function.
 */
export function deduplicateByEmbedding(
  embeddings: number[][],
  threshold = 0.92,
  preferIndex?: (a: number, b: number) => number,
): number[] {
  const removed = new Set<number>();

  for (let i = 0; i < embeddings.length; i++) {
    if (removed.has(i)) continue;
    for (let j = i + 1; j < embeddings.length; j++) {
      if (removed.has(j)) continue;
      const sim = cosineSimilarity(embeddings[i], embeddings[j]);
      if (sim >= threshold) {
        // Remove the less preferred one
        const keep = preferIndex ? preferIndex(i, j) : i;
        const remove = keep === i ? j : i;
        removed.add(remove);
      }
    }
  }

  return Array.from({ length: embeddings.length }, (_, i) => i).filter(
    (i) => !removed.has(i),
  );
}

/**
 * Safely embed with fallback — returns null if embedding fails.
 * Use this in non-critical paths where embedding is optional.
 */
export async function safeEmbed(text: string): Promise<number[] | null> {
  try {
    return await embed(text);
  } catch (err) {
    console.warn("Embedding failed, continuing without:", err);
    return null;
  }
}

/**
 * Safely batch embed with fallback — returns null for the entire batch if it fails.
 */
export async function safeEmbedBatch(
  texts: string[],
): Promise<number[][] | null> {
  try {
    return await embedBatch(texts);
  } catch (err) {
    console.warn("Batch embedding failed, continuing without:", err);
    return null;
  }
}
