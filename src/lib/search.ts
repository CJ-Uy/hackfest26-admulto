export async function webSearch(query: string, count = 5) {
  console.log(
    `[web-search] 📡 Starting SearXNG search for: "${query}" (count: ${count}), url: ${process.env.SEARXNG_URL}`,
  );
  const res = await fetch(
    `${process.env.SEARXNG_URL}/search?` +
      new URLSearchParams({
        q: query,
        format: "json",
        categories: "general,science",
        language: "en",
      }),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as Record<string, any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = (data.results as any[]).slice(0, count).map((r: any) => ({
    title: r.title,
    url: r.url,
    snippet: r.content || "",
    engine: r.engine,
  }));
  console.log(`[web-search] ✅ SearXNG returned ${results.length} results`);
  return results;
}
