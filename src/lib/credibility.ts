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
      color: "text-green-400",
      bg: "bg-green-100",
      textOnBg: "text-green-700",
    };
  if (score >= 70)
    return {
      label: "Credible",
      description:
        "Strong citation record or published in a recognized venue.",
      color: "text-blue-400",
      bg: "bg-blue-100",
      textOnBg: "text-blue-700",
    };
  if (score >= 55)
    return {
      label: "Moderate",
      description:
        "Some academic citations. May lack venue publication or be older.",
      color: "text-amber-400",
      bg: "bg-amber-100",
      textOnBg: "text-amber-700",
    };
  if (score >= 40)
    return {
      label: "Limited",
      description:
        "Few citations and no recognized venue. Interpret with caution.",
      color: "text-orange-400",
      bg: "bg-orange-100",
      textOnBg: "text-orange-700",
    };
  return {
    label: "Unverified",
    description:
      "Insufficient data to assess credibility. Sourced from web search.",
    color: "text-gray-400",
    bg: "bg-gray-100",
    textOnBg: "text-gray-600",
  };
}
