import { webSearch } from "./search";
import { getSmartModel } from "./ollama";

const S2_API = "https://api.semanticscholar.org/graph/v1/paper/search";

async function searchPapers(query: string, limit = 10) {
  const params = new URLSearchParams({
    query,
    limit: String(limit),
    fields: "title,abstract,url,year,citationCount,isOpenAccess,authors,tldr",
  });
  const res = await fetch(`${S2_API}?${params}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as Record<string, any>;
  return (data.data as Record<string, unknown>[]) || [];
}

export async function agentQuery(userQuery: string) {
  // Step 1: Send to Qwen with tools defined
  const res = await fetch(`${process.env.OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: getSmartModel(),
      stream: false,
      messages: [
        {
          role: "system",
          content:
            "You are a research assistant. Use the available tools to find " +
            "papers and web sources before answering.",
        },
        { role: "user", content: userQuery },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "web_search",
            description:
              "Search the web for articles, news, and general sources",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string", description: "Search query" },
              },
              required: ["query"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "search_papers",
            description: "Search for academic research papers",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string", description: "Research topic" },
              },
              required: ["query"],
            },
          },
        },
      ],
    }),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as Record<string, any>;
  const assistantMsg = data.message;

  // Step 2: If Qwen requested tool calls, execute them
  if (assistantMsg.tool_calls?.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: Record<string, any>[] = [
      { role: "system", content: "You are a research assistant." },
      { role: "user", content: userQuery },
      assistantMsg, // includes tool_calls
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const toolCall of assistantMsg.tool_calls as any[]) {
      const { name, arguments: args } = toolCall.function;
      let result;

      if (name === "web_search") {
        // Call YOUR SearXNG instance
        result = await webSearch(args.query);
      } else if (name === "search_papers") {
        // Call Semantic Scholar (free, no key needed)
        result = await searchPapers(args.query);
      }

      messages.push({
        role: "tool",
        content: JSON.stringify(result),
      });
    }

    // Step 3: Send tool results back to Qwen for final answer
    const finalRes = await fetch(`${process.env.OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: getSmartModel(),
        stream: false,
        messages,
      }),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalData = (await finalRes.json()) as Record<string, any>;
    return finalData.message.content;
  }

  return assistantMsg.content;
}
