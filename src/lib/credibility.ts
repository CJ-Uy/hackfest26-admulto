export function getCredibilityTier(score: number): {
  label: string;
  description: string;
  color: string;
  bg: string;
  textOnBg: string;
} {
  if (score >= 85)
    return {
      label: "Highly Credible",
      description:
        "Well-cited research published in a recognized venue. Recently published.",
      color: "text-green-500 dark:text-green-300",
      bg: "bg-green-100 dark:bg-green-950/60",
      textOnBg: "text-green-700 dark:text-green-200",
    };
  if (score >= 70)
    return {
      label: "Credible",
      description: "Strong citation record or published in a recognized venue.",
      color: "text-blue-500 dark:text-blue-300",
      bg: "bg-blue-100 dark:bg-blue-950/60",
      textOnBg: "text-blue-700 dark:text-blue-200",
    };
  if (score >= 55)
    return {
      label: "Moderate",
      description:
        "Some academic citations. May lack venue publication or be older.",
      color: "text-amber-500 dark:text-amber-300",
      bg: "bg-amber-100 dark:bg-amber-950/60",
      textOnBg: "text-amber-700 dark:text-amber-200",
    };
  if (score >= 40)
    return {
      label: "Limited",
      description:
        "Few citations and no recognized venue. Interpret with caution.",
      color: "text-orange-500 dark:text-orange-300",
      bg: "bg-orange-100 dark:bg-orange-950/60",
      textOnBg: "text-orange-700 dark:text-orange-200",
    };
  return {
    label: "Unverified",
    description:
      "Insufficient data to assess credibility. Sourced from web search.",
    color: "text-gray-500 dark:text-gray-300",
    bg: "bg-gray-100 dark:bg-zinc-900/70",
    textOnBg: "text-gray-600 dark:text-gray-200",
  };
}
