export async function webSearch(query: string, count = 5) {
  const res = await fetch(
    `${process.env.SEARXNG_URL}/search?` +
      new URLSearchParams({
        q: query,
        format: "json",
        categories: "general,science",
        language: "en",
      }),
  );
  const data = await res.json();

  return data.results.slice(0, count).map((r: any) => ({
    title: r.title,
    url: r.url,
    snippet: r.content || "",
    engine: r.engine,
  }));
}
