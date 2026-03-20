import type { Paper, ExportTheme, ScrollSession, Poll } from "@/lib/types";

export interface StoredScroll {
  scroll: ScrollSession;
  papers: Paper[];
  exportOutline: ExportTheme[];
  polls: Poll[];
}

// ---------- API-backed fetchers ----------

export async function fetchAllScrollSessions(): Promise<ScrollSession[]> {
  try {
    const res = await fetch("/api/scrolls");
    if (!res.ok) return [];
    return (await res.json()) as ScrollSession[];
  } catch {
    return [];
  }
}

export async function fetchScroll(id: string): Promise<StoredScroll | null> {
  try {
    const res = await fetch(`/api/scrolls/${id}`);
    if (!res.ok) return null;
    return (await res.json()) as StoredScroll;
  } catch {
    return null;
  }
}

export async function fetchPaperFromScroll(
  scrollId: string,
  paperId: string
): Promise<Paper | null> {
  const data = await fetchScroll(scrollId);
  if (!data) return null;
  return data.papers.find((p) => p.id === paperId) ?? null;
}
