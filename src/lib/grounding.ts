export async function verifyCard(sourceText: string, synthesis: string) {
  const res = await fetch(`${process.env.DEBERTA_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source_text: sourceText,
      synthesis: synthesis,
    }),
  });

  return await res.json();
  // Returns:
  // {
  //   card_verified: true/false,
  //   threshold_used: 0.85,
  //   claims: [
  //     { claim: "...", entailment_score: 0.92, passed: true },
  //     { claim: "...", entailment_score: 0.41, passed: false },
  //   ],
  //   summary: "2/2 claims verified",
  //   processing_time_ms: 340.2
  // }
}
