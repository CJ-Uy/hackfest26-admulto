// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

// Concurrency control for Ollama calls - keep low (1) for tunnelled/local setups
export const OLLAMA_CONCURRENCY = 1;
export const OLLAMA_COMMENT_CONCURRENCY = 1;

// phi4-mini is fastest for short generations (synthesis, citations)
// Use llama3 for more complex reasoning tasks (comments, outlines)
export const DEFAULT_FAST_MODEL = "phi4-mini:3.8b";
export const DEFAULT_SMART_MODEL = "llama3:8b";

let FAST_MODEL = DEFAULT_FAST_MODEL;
let SMART_MODEL = DEFAULT_SMART_MODEL;

export function setModels(fast?: string, smart?: string) {
  if (fast) FAST_MODEL = fast;
  if (smart) SMART_MODEL = smart;
}

export function getSmartModel() {
  return SMART_MODEL;
}

function extractJsonArrayCandidate(raw: string): unknown[] | null {
  const trimmed = raw.trim();
  const candidates: string[] = [];

  // Raw response may already be JSON.
  if (trimmed) candidates.push(trimmed);

  // Support fenced output like ```json ... ```.
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    candidates.push(fenceMatch[1].trim());
  }

  // Extract bracketed array payload.
  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    candidates.push(trimmed.slice(firstBracket, lastBracket + 1));
  }

  // Some models wrap arrays as { "questions": [...] }.
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (Array.isArray(parsed)) return parsed;
      if (
        parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { questions?: unknown[] }).questions)
      ) {
        return (parsed as { questions: unknown[] }).questions;
      }
    } catch {
      // Keep trying the next candidate.
    }
  }

  return null;
}

async function ollamaChat(
  systemPrompt: string,
  userPrompt: string,
  model: string = FAST_MODEL,
  retries: number = 3,
): Promise<string> {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          options: {
            num_predict: 256, // cap token output for speed
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

      const data = (await res.json()) as AnyRecord;
      return (data.message?.content as string) ?? "";
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

export async function generateSynthesis(
  title: string,
  abstract: string,
  authors: string[],
): Promise<string> {
  return ollamaChat(
    "You are Schrollar's research card writer. Write a 2-3 sentence " +
      "social-media-style post summarizing a research paper. " +
      "ONLY use facts stated in the abstract — do NOT add claims, " +
      "implications, or details not explicitly mentioned. " +
      "Do NOT use hashtags. Do NOT use markdown. Plain text only.",
    `Summarize this paper as a social media post:\n\n` +
      `Title: ${title}\n` +
      `Authors: ${authors.join(", ")}\n` +
      `Abstract: ${abstract}`,
  );
}

export async function generateApaCitation(
  title: string,
  authors: string[],
  year: number | null,
  journal: string,
  doi: string,
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
      : formatted.slice(0, -1).join(", ") +
        ", & " +
        formatted[formatted.length - 1];

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
  }>,
): Promise<string> {
  const paperList = papers
    .map(
      (p, i) =>
        `[${i + 1}] "${p.title}" by ${p.authors} (${p.year})\nSummary: ${p.synthesis}\nCitation: ${p.apaCitation}`,
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
    `Here are the papers to organize:\n\n${paperList}`,
    SMART_MODEL,
  );
}

// ─── Reply comment generation ────────────────────────────────────────────────

/**
 * Generate a reply to a user's comment from a paper's perspective.
 */
export async function generateReplyComment(
  paperContext: {
    title: string;
    synthesis: string;
    authors: string[];
    doi?: string;
  },
  userComment: string,
  threadContext?: string[],
): Promise<string> {
  const authorStr =
    paperContext.authors.slice(0, 2).join(", ") || "the authors";
  const threadStr = threadContext?.length
    ? `\n\nPrevious messages in this thread:\n${threadContext.map((m, i) => `${i + 1}. ${m}`).join("\n")}`
    : "";

  return ollamaChat(
    `You are a researcher replying to a reader's comment on a research paper platform. You are speaking from the perspective of the paper "${paperContext.title}" by ${authorStr}.

CRITICAL RULES:
- ONLY mention facts, findings, or claims that appear in YOUR PAPER'S SUMMARY below. Do NOT invent results, statistics, or methodologies.
- If the comment asks about something your paper doesn't cover, say so honestly.
- Keep it to 1-3 sentences. Sound like a real person, not a formal academic.
- Do NOT use markdown formatting.
- Do NOT include any URLs or links.`,
    `YOUR PAPER'S SUMMARY (this is the ONLY information you can reference about your work):\n${paperContext.synthesis}${threadStr}\n\nThe reader's comment: "${userComment}"\n\nReply to them using ONLY facts from your summary:`,
    SMART_MODEL,
  );
}

/**
 * Generate comments on a user's post from papers' perspectives.
 */
export async function generatePostComments(
  postContent: string,
  papers: Array<{
    title: string;
    synthesis: string;
    authors: string[];
    doi?: string;
  }>,
  topic: string,
): Promise<Array<{ author: string; content: string; relationship: string }>> {
  if (papers.length === 0) return [];

  const selectedPapers = papers.slice(0, 3);
  const paperList = selectedPapers
    .map(
      (p, i) =>
        `[Paper ${i + 1}] "${p.title}" by ${p.authors.slice(0, 2).join(", ")}\nSummary: ${p.synthesis}`,
    )
    .join("\n\n");

  const prompt = `A user posted this on a research feed about "${topic}":
"${postContent}"

These researchers want to respond:
${paperList}

For each researcher, write a SHORT (1-2 sentence) response to the user's post from their research perspective. They should engage with the user's point and reference their own work naturally.
Do NOT include any URLs or links in your response text — links are added automatically.

RESPOND ONLY with valid JSON array, no markdown:
[
  {
    "author": "First Author Last Name et al.",
    "content": "The response text",
    "relationship": "responds"
  }
]`;

  try {
    const raw = await ollamaChat(
      "You generate realistic social media responses from researchers. Output ONLY valid JSON arrays.",
      prompt,
      SMART_MODEL,
    );

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      author: string;
      content: string;
      relationship: string;
    }>;
    return parsed.filter((c) => c.author && c.content);
  } catch (err) {
    console.error("Failed to generate post comments:", err);
    return [];
  }
}

/**
 * Generate comments on a user post using web search results as context.
 * Unlike generatePostComments which uses existing papers, this creates
 * knowledgeable commenters based on real web search results.
 */
export async function generateWebInformedComments(
  postContent: string,
  webResults: Array<{ title: string; snippet: string; url: string }>,
  topic: string,
): Promise<Array<{ author: string; content: string; relationship: string }>> {
  if (webResults.length === 0) return [];

  const sourceList = webResults
    .slice(0, 4)
    .map((r, i) => `[Source ${i + 1}] "${r.title}"\nKey info: ${r.snippet}`)
    .join("\n\n");

  const prompt = `A user posted this on a research feed about "${topic}":
"${postContent}"

Here are relevant sources found via web search:
${sourceList}

Generate 2-3 SHORT (1-2 sentence) responses from knowledgeable researchers. Each commenter should:
- Reference specific findings from the sources above
- Engage directly with the user's point
- Sound like a real person casually discussing on social media
- Do NOT include any URLs or links in your response text — links are added automatically.

RESPOND ONLY with valid JSON array, no markdown:
[
  {
    "author": "A realistic researcher name",
    "content": "The response text",
    "relationship": "responds"
  }
]`;

  try {
    const raw = await ollamaChat(
      "You generate realistic social media responses from researchers. Output ONLY valid JSON arrays.",
      prompt,
      SMART_MODEL,
    );

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      author: string;
      content: string;
      relationship: string;
    }>;
    return parsed.filter((c) => c.author && c.content);
  } catch (err) {
    console.error("Failed to generate web-informed comments:", err);
    return [];
  }
}

/**
 * Generate an AI reply to a user comment on a user post, using web search context.
 */
export async function generateUserPostReply(
  postContent: string,
  userComment: string,
  webContext: string,
): Promise<string> {
  return ollamaChat(
    `You are a knowledgeable researcher replying to a comment on a research discussion platform. The original post was about a research topic.

CRITICAL RULES:
- ONLY reference facts that appear in the web search context provided below. Do NOT invent statistics, studies, or claims.
- If the context doesn't cover what the user is asking about, acknowledge that honestly.
- Keep it to 1-3 sentences. Sound like a real person, not a formal academic.
- Do NOT use markdown formatting.`,
    `Original post: "${postContent}"\n\nRelevant context (ONLY use facts from this):\n${webContext}\n\nThe user's comment: "${userComment}"\n\nReply using ONLY information from the context above:`,
    SMART_MODEL,
  );
}

/**
 * Generate fine-tune QnA questions based on current feed content.
 */
export async function generateFineTuneQuestions(
  papers: Array<{ title: string; synthesis: string }>,
  topic: string,
): Promise<Array<{ question: string; options: string[] }>> {
  const paperSummaries = papers
    .slice(0, 8)
    .map((p, i) => `${i + 1}. "${p.title}" — ${p.synthesis}`)
    .join("\n");

  const prompt = `Based on this research feed about "${topic}", generate 5 multiple-choice questions to understand the user's preferences better. Each question should have 3-4 options. The questions should help curate and refine the feed.

Papers in the feed:
${paperSummaries}

Types of questions to ask:
- What subtopic they want to dive deeper into
- What methodology they prefer (empirical, theoretical, review, etc.)
- What time period of research interests them
- How technical/accessible they want the content
- What type of insights they're looking for (practical, foundational, cutting-edge)

RESPOND ONLY with valid JSON array, no markdown:
[
  {
    "question": "The question text",
    "options": ["Option A", "Option B", "Option C", "Option D"]
  }
]`;

  try {
    const raw = await ollamaChat(
      "You generate research preference questions. Output ONLY valid JSON arrays.",
      prompt,
      SMART_MODEL,
    );

    const parsed = extractJsonArrayCandidate(raw);
    if (!parsed) {
      return [];
    }

    return (parsed as Array<{ question?: unknown; options?: unknown }>)
      .filter(
        (q) =>
          typeof q.question === "string" &&
          Array.isArray(q.options) &&
          q.options.length >= 2,
      )
      .map((q) => ({
        question: (q.question as string).trim(),
        options: (q.options as unknown[])
          .filter((opt): opt is string => typeof opt === "string")
          .map((opt) => opt.trim())
          .filter(Boolean),
      }))
      .filter((q) => q.question && q.options.length >= 2);
  } catch (err) {
    console.error("Failed to generate fine-tune questions:", err);
    return [];
  }
}

// ─── Export summary generation ────────────────────────────────────────────────

/**
 * Generate an overall research summary for all papers.
 */
export async function generateOverallSummary(
  papers: Array<{ title: string; synthesis: string; authors: string[] }>,
): Promise<string> {
  const paperList = papers
    .map((p, i) => `${i + 1}. "${p.title}" — ${p.synthesis}`)
    .join("\n");

  return ollamaChat(
    "You write concise research summaries. Output ONLY the summary text, no markdown headers or formatting. Do NOT invent facts — only synthesize from what is provided.",
    `Write a 3-5 sentence overall summary that synthesizes the key themes and findings across these research papers:\n\n${paperList}\n\nSummary:`,
    SMART_MODEL,
  );
}

/**
 * Generate a per-paper summary for export (shorter than synthesis).
 */
export async function generatePerPaperSummary(
  title: string,
  synthesis: string,
): Promise<string> {
  return ollamaChat(
    "You write concise one-sentence research summaries. Output ONLY the summary, no markdown. Do NOT invent facts.",
    `Summarize the key contribution of this paper in one sentence:\n\nTitle: "${title}"\nDetails: ${synthesis}\n\nOne-sentence summary:`,
    FAST_MODEL,
  );
}

/**
 * Generate a themed/grouped export with section summaries.
 */
export async function generateThemedExport(
  papers: Array<{
    title: string;
    synthesis: string;
    authors: string[];
    year: number;
    apaCitation: string;
  }>,
): Promise<string> {
  const paperList = papers
    .map(
      (p, i) =>
        `[${i + 1}] "${p.title}" by ${p.authors.join(", ")} (${p.year})\nSummary: ${p.synthesis}\nCitation: ${p.apaCitation}`,
    )
    .join("\n\n");

  return ollamaChat(
    `You are a research outline generator. Given academic papers, create a comprehensive themed export. Group papers into 2-4 thematic categories.

RESPOND ONLY with valid JSON, no markdown:
{
  "overallSummary": "3-5 sentence synthesis of all research",
  "themes": [
    {
      "title": "Theme Name",
      "summary": "2-3 sentence section summary",
      "sources": [
        {
          "title": "Paper Title",
          "authors": "Author names",
          "year": 2020,
          "keyFinding": "One sentence key finding",
          "apaCitation": "Full APA citation"
        }
      ]
    }
  ]
}

Rules:
- overallSummary must synthesize across ALL papers
- Each section summary must synthesize the papers within that theme
- Each source's keyFinding must come from the paper's provided summary — do NOT invent
- Each paper appears in exactly one theme
- Use exact APA citations as provided`,
    `Papers to organize:\n\n${paperList}`,
    SMART_MODEL,
  );
}

// ─── PDF verification Q&A ─────────────────────────────────────────────────────

/**
 * Generate verification questions about a PDF's contents to confirm the
 * system understood the paper correctly.
 */
export async function generatePdfVerificationQuestions(
  title: string,
  abstract: string,
  fullText: string,
): Promise<
  Array<{
    question: string;
    options: string[];
    correctIndex: number;
  }>
> {
  const textSnippet = fullText.slice(0, 3000);

  const prompt = `Based on this academic paper, generate 3 multiple-choice questions that verify whether the system correctly understood the paper's key content.

Paper Title: "${title}"
Abstract: ${abstract}
Content excerpt: ${textSnippet}

The questions should test understanding of:
1. The paper's main research topic or thesis
2. The methodology or approach used
3. A key finding or conclusion

Each question should have 4 options with exactly one correct answer.

RESPOND ONLY with valid JSON array, no markdown:
[
  {
    "question": "What is the main focus of this paper?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0
  }
]`;

  try {
    const raw = await ollamaChat(
      "You generate academic comprehension questions based on paper content. Output ONLY valid JSON arrays. Questions must be answerable from the provided text.",
      prompt,
      SMART_MODEL,
    );

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      question: string;
      options: string[];
      correctIndex: number;
    }>;
    return parsed.filter(
      (q) =>
        q.question &&
        q.options?.length >= 2 &&
        typeof q.correctIndex === "number",
    );
  } catch (err) {
    console.error("Failed to generate PDF verification questions:", err);
    return [];
  }
}

// ─── Social comment generation ───────────────────────────────────────────────

export interface GeneratedComment {
  author: string;
  content: string;
  relationship: "agrees" | "disagrees" | "extends" | "cites" | "questions";
}

/**
 * Generate social-media-style comments from other papers' perspectives.
 * Each "commenter" is another paper in the same scroll, reacting to this paper
 * as if the papers were people on social media.
 */
export async function generateSocialComments(
  targetPaper: { title: string; synthesis: string; authors: string[] },
  otherPapers: Array<{
    title: string;
    synthesis: string;
    authors: string[];
    year: number;
    citationCount: number;
    doi?: string;
  }>,
  maxComments = 3,
): Promise<GeneratedComment[]> {
  if (otherPapers.length === 0) return [];

  // Pick a diverse subset of papers to comment
  const commenters = otherPapers.slice(0, maxComments);

  const commenterList = commenters
    .map(
      (p, i) =>
        `[Commenter ${i + 1}] "${p.title}" by ${p.authors.slice(0, 2).join(", ")} (${p.year}, ${p.citationCount} citations)\nTheir work: ${p.synthesis}`,
    )
    .join("\n\n");

  const prompt = `You are generating social media comments for a research paper platform. Each comment is written FROM THE PERSPECTIVE of another research paper's authors, as if they are a person reacting to a post.

THE POST (paper being commented on):
"${targetPaper.title}" by ${targetPaper.authors.slice(0, 2).join(", ")}
${targetPaper.synthesis}

THE COMMENTERS (other papers whose authors will react):
${commenterList}

For each commenter, write a SHORT (1-2 sentence) social-media-style comment reacting to the post from their research perspective. They should:
- ONLY reference facts, findings, or claims that appear in THEIR OWN paper summary above. Do NOT invent statistics, methodologies, or results.
- Reference their own work naturally ("In our study, we found..." or "This aligns with our findings on...")
- Show genuine academic interaction: agreeing, respectfully disagreeing, asking questions, noting they cited this work, or explaining how they extended it
- Sound like real researchers casually discussing on social media, NOT formal peer review
- Be specific about HOW the papers relate, using ONLY information from the summaries provided
- Do NOT include any URLs or links in your comment text — links are added automatically.

RESPOND ONLY with valid JSON array, no markdown:
[
  {
    "author": "First Author Last Name et al.",
    "content": "The comment text",
    "relationship": "agrees|disagrees|extends|cites|questions"
  }
]`;

  try {
    const raw = await ollamaChat(
      "You generate realistic social media comments between researchers. Output ONLY valid JSON arrays.",
      prompt,
      SMART_MODEL,
    );

    // Extract JSON array from response
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as GeneratedComment[];
    return parsed.filter((c) => c.author && c.content && c.relationship);
  } catch (err) {
    console.error("Failed to generate social comments:", err);
    return [];
  }
}
