// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = "qwen3:8b";

async function ollamaChat(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama request failed: ${res.status}`);
  }

  const data = (await res.json()) as AnyRecord;
  return (data.message?.content as string) ?? "";
}

export async function generateSynthesis(
  title: string,
  abstract: string,
  authors: string[]
): Promise<string> {
  return ollamaChat(
    "You are Schrollar's research card writer. Write a 2-3 sentence " +
      "social-media-style post summarizing a research paper. Be accurate. " +
      "Do NOT add information not in the source. Do NOT use hashtags. " +
      "Do NOT use markdown formatting. Just plain text.",
    `Summarize this paper as a social media post:\n\n` +
      `Title: ${title}\n` +
      `Authors: ${authors.join(", ")}\n` +
      `Abstract: ${abstract}`
  );
}

export async function generateApaCitation(
  title: string,
  authors: string[],
  year: number | null,
  journal: string,
  doi: string
): Promise<string> {
  // Format authors for APA: Last, F. I., & Last, F. I.
  const formatted = authors
    .map((name) => {
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) return parts[0];
      const last = parts[parts.length - 1];
      const initials = parts
        .slice(0, -1)
        .map((p) => p.charAt(0).toUpperCase() + ".")
        .join(" ");
      return `${last}, ${initials}`;
    })
    .slice(0, 7);

  const authorStr =
    formatted.length <= 2
      ? formatted.join(", & ")
      : formatted.slice(0, -1).join(", ") + ", & " + formatted[formatted.length - 1];

  const yearStr = year ? ` (${year})` : " (n.d.)";
  const journalStr = journal ? ` ${journal}.` : "";
  const doiStr = doi ? ` https://doi.org/${doi}` : "";

  return `${authorStr}${yearStr}. ${title}.${journalStr}${doiStr}`;
}

export async function generateExportOutline(
  papers: Array<{
    title: string;
    authors: string;
    year: number;
    synthesis: string;
    apaCitation: string;
  }>
): Promise<string> {
  const paperList = papers
    .map(
      (p, i) =>
        `[${i + 1}] "${p.title}" by ${p.authors} (${p.year})\nSummary: ${p.synthesis}\nCitation: ${p.apaCitation}`
    )
    .join("\n\n");

  return ollamaChat(
    `You are a research outline generator. Given a list of academic papers, group them into 2-4 thematic categories and produce a structured JSON outline.

RESPOND ONLY with valid JSON in this exact format, no markdown, no explanation:
{
  "themes": [
    {
      "title": "Theme Name",
      "summary": "2-3 sentence summary of this research theme.",
      "sources": [
        {
          "title": "Paper Title",
          "authors": "Author names",
          "year": 2020,
          "keyFinding": "One sentence key finding.",
          "apaCitation": "Full APA citation"
        }
      ]
    }
  ]
}

Rules:
- Each paper should appear in exactly one theme
- Summaries should synthesize, not just list
- Key findings should be specific and informative
- Use the exact APA citations provided`,
    `Here are the papers to organize:\n\n${paperList}`
  );
}
