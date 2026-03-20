export async function generateSynthesis(
  title: string,
  abstract: string,
  authors: string[],
) {
  const res = await fetch(`${process.env.OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen3.5:9b",
      stream: false,
      messages: [
        {
          role: "system",
          content:
            "You are Schrollar's research card writer. Write a 2-3 sentence " +
            "social-media-style post summarizing a research paper. Be accurate. " +
            "Do NOT add information not in the source. Do NOT use hashtags.",
        },
        {
          role: "user",
          content:
            `Summarize this paper as a social media post:\n\n` +
            `Title: ${title}\n` +
            `Authors: ${authors.join(", ")}\n` +
            `Abstract: ${abstract}`,
        },
      ],
    }),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as Record<string, any>;
  return data.message.content as string;
}
