import { computeEngagementScores } from "@/lib/engagement-scoring";
import { gatherInteractionContext } from "@/lib/interaction-context";

function formatAuthor(authors: string[]): string {
  if (authors.length === 0) return "Unknown";
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return authors.join(" & ");
  return `${authors[0]} et al.`;
}

export async function buildResearchPrompt(
  scrollId: string,
): Promise<string> {
  const [scored, ctx] = await Promise.all([
    computeEngagementScores(scrollId),
    gatherInteractionContext(scrollId),
  ]);

  // Build comment lookup from interaction context
  const commentsByTitle = new Map<string, string[]>();
  for (const cp of ctx.commentedPapers) {
    commentsByTitle.set(cp.title, cp.userComments);
  }

  // Partition papers by tier
  const core = scored.filter((p) => p.tier === "core");
  const supporting = scored.filter((p) => p.tier === "supporting");
  const peripheral = scored.filter((p) => p.tier === "peripheral");

  const lines: string[] = [];

  // Header
  lines.push(`I'm researching "${ctx.topic}". ${ctx.description}`);
  lines.push("");
  lines.push(
    "Here are key papers I've reviewed, ranked by relevance to my interests:",
  );
  lines.push("");

  // Core papers — full detail with synthesis and user comments
  if (core.length > 0) {
    lines.push("**Core papers (most relevant to me):**");
    for (const p of core) {
      lines.push(
        `- "${p.title}" (${formatAuthor(p.authors)}, ${p.year}) — ${p.synthesis}`,
      );
      const comments = commentsByTitle.get(p.title);
      if (comments && comments.length > 0) {
        lines.push(`  My notes: ${comments.join("; ")}`);
      }
    }
    lines.push("");
  }

  // Supporting papers — synthesis only
  if (supporting.length > 0) {
    lines.push("**Supporting papers:**");
    for (const p of supporting) {
      lines.push(
        `- "${p.title}" (${formatAuthor(p.authors)}, ${p.year}) — ${p.synthesis}`,
      );
    }
    lines.push("");
  }

  // Peripheral papers — brief citation only
  if (peripheral.length > 0) {
    lines.push("**Other papers reviewed:**");
    for (const p of peripheral) {
      lines.push(`- "${p.title}" (${formatAuthor(p.authors)}, ${p.year})`);
    }
    lines.push("");
  }

  // If no engagement at all, list all papers with synthesis
  if (core.length === 0 && supporting.length === 0) {
    lines.push("**Papers reviewed:**");
    for (const p of scored) {
      lines.push(
        `- "${p.title}" (${formatAuthor(p.authors)}, ${p.year}) — ${p.synthesis}`,
      );
    }
    lines.push("");
  }

  // Poll answers — research preferences
  if (ctx.pollAnswers.length > 0) {
    lines.push("**My research preferences:**");
    for (const pa of ctx.pollAnswers) {
      lines.push(`- Q: ${pa.question} → A: ${pa.answer}`);
    }
    lines.push("");
  }

  // User posts — research notes
  if (ctx.userPostContent.length > 0) {
    lines.push("**My research notes:**");
    for (const post of ctx.userPostContent) {
      lines.push(`- ${post}`);
    }
    lines.push("");
  }

  // Closing instructions
  lines.push("Based on this foundation, help me:");
  lines.push("1. Identify gaps in this literature");
  lines.push(
    "2. Suggest related papers or research directions I may have missed",
  );
  lines.push(`3. Draft an outline for a paper on ${ctx.topic}`);

  return lines.join("\n");
}
