import type { OnboardingPreset } from "@/lib/types";

export const onboardingPresets: Record<string, OnboardingPreset> = {
  brainstorm: {
    topic: "Cognitive Psychology and Decision-Making",
    description:
      "I want to explore how cognitive biases affect everyday decision-making, particularly in academic and professional contexts.",
    subfields: ["Confirmation Bias", "Heuristics", "Behavioral Economics"],
  },
  citationFinder: {
    topic: "Climate Policy Effectiveness in Southeast Asia",
    description:
      "I'm writing a paper on how climate policies in ASEAN countries have impacted carbon emissions over the past decade.",
    subfields: [
      "Carbon Pricing",
      "ASEAN Environmental Policy",
      "Emissions Reduction",
    ],
  },
};
