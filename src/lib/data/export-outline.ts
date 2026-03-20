import type { ExportTheme } from "@/lib/types";

export const exportOutline: ExportTheme[] = [
  {
    title: "Cognitive Biases in Decision-Making",
    summary:
      "Research consistently demonstrates that human decision-making is subject to systematic biases. These biases arise from reliance on mental shortcuts (heuristics) that, while efficient, produce predictable errors. Key biases include anchoring, availability, confirmation bias, and the Dunning-Kruger effect.",
    sources: [
      {
        title: "Judgment Under Uncertainty: Heuristics and Biases",
        authors: "Kahneman, D., & Tversky, A.",
        year: 1974,
        keyFinding:
          "People rely on representativeness, availability, and anchoring heuristics when estimating probabilities, leading to systematic errors.",
        apaCitation:
          "Kahneman, D., & Tversky, A. (1974). Judgment under uncertainty: Heuristics and biases. Science, 185(4157), 1124\u20131131.",
      },
      {
        title:
          "Confirmation Bias: A Ubiquitous Phenomenon in Many Guises",
        authors: "Nickerson, R. S.",
        year: 1998,
        keyFinding:
          "Confirmation bias operates through selective seeking, biased interpretation, and preferential recall of information that supports existing beliefs.",
        apaCitation:
          "Nickerson, R. S. (1998). Confirmation bias: A ubiquitous phenomenon in many guises. Review of General Psychology, 2(2), 175\u2013220.",
      },
      {
        title:
          "Unskilled and Unaware of It: The Dunning-Kruger Effect",
        authors: "Kruger, J., & Dunning, D.",
        year: 1999,
        keyFinding:
          "Individuals with low competence in a domain systematically overestimate their abilities due to metacognitive deficits.",
        apaCitation:
          "Kruger, J., & Dunning, D. (1999). Unskilled and unaware of it. Journal of Personality and Social Psychology, 77(6), 1121\u20131134.",
      },
    ],
  },
  {
    title: "Dual-Process Theory and Rational Constraints",
    summary:
      "The dual-process framework distinguishes between fast, intuitive (System 1) and slow, deliberate (System 2) cognitive processes. Bounded rationality theory explains why humans satisfice rather than optimize, constrained by cognitive capacity, time, and information availability.",
    sources: [
      {
        title:
          "A Perspective on Judgment and Choice: Mapping Bounded Rationality",
        authors: "Kahneman, D.",
        year: 2003,
        keyFinding:
          "System 1 governs most everyday decisions efficiently but introduces systematic biases; System 2 engagement requires effort and is capacity-limited.",
        apaCitation:
          "Kahneman, D. (2003). A perspective on judgment and choice: Mapping bounded rationality. American Psychologist, 58(9), 697\u2013720.",
      },
      {
        title:
          "Rational Choice and the Structure of the Environment",
        authors: "Simon, H. A.",
        year: 1956,
        keyFinding:
          "Decision-makers operate under bounded rationality, choosing satisfactory options rather than optimal ones due to cognitive and environmental constraints.",
        apaCitation:
          "Simon, H. A. (1956). Rational choice and the structure of the environment. Psychological Review, 63(2), 129\u2013138.",
      },
      {
        title:
          "Cognitive Reflection and Decision Making",
        authors: "Frederick, S.",
        year: 2005,
        keyFinding:
          "The Cognitive Reflection Test measures the tendency to engage deliberate thinking, predicting risk preferences and decision quality.",
        apaCitation:
          "Frederick, S. (2005). Cognitive reflection and decision making. Journal of Economic Perspectives, 19(4), 25\u201342.",
      },
    ],
  },
  {
    title: "Behavioral Interventions and Choice Architecture",
    summary:
      "Building on insights from cognitive bias research, behavioral interventions (nudges) leverage choice architecture to guide better decisions. This approach has been applied in public policy, healthcare, education, and digital environments, though ethical considerations remain an active area of debate.",
    sources: [
      {
        title: "Libertarian Paternalism",
        authors: "Thaler, R. H., & Sunstein, C. R.",
        year: 2003,
        keyFinding:
          "Default options, framing, and social norms can nudge people toward better outcomes while preserving freedom of choice.",
        apaCitation:
          "Thaler, R. H., & Sunstein, C. R. (2003). Libertarian paternalism. The American Economic Review, 93(2), 175\u2013179.",
      },
      {
        title: "Digital Nudging",
        authors: "Weinmann, M., Schneider, C., & vom Brocke, J.",
        year: 2016,
        keyFinding:
          "Digital interface design elements (defaults, ordering, social proof) significantly shape online user decisions.",
        apaCitation:
          "Weinmann, M., Schneider, C., & vom Brocke, J. (2016). Digital nudging. Business & Information Systems Engineering, 58(6), 433\u2013436.",
      },
    ],
  },
];
