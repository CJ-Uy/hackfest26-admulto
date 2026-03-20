import type { Poll } from "@/lib/types";

export const polls: Poll[] = [
  {
    id: "poll1",
    type: "multiple-choice",
    question: "Which area of cognitive psychology interests you most?",
    options: [
      "Cognitive Biases & Heuristics",
      "Behavioral Economics",
      "Neuroscience of Decision-Making",
      "Social Psychology & Group Decisions",
    ],
  },
  {
    id: "poll2",
    type: "multiple-choice",
    question:
      "What type of research sources do you prefer for your paper?",
    options: [
      "Foundational/classic papers (pre-2000)",
      "Modern empirical studies (2000\u20132015)",
      "Recent cutting-edge research (2015+)",
      "A mix of all eras",
    ],
  },
  {
    id: "poll3",
    type: "open-ended",
    question:
      "What specific research question are you trying to answer?",
  },
  {
    id: "poll4",
    type: "multiple-choice",
    question:
      "Which application domain interests you for decision-making research?",
    options: [
      "Healthcare & Medical Decisions",
      "Education & Academic Choices",
      "Public Policy & Government",
      "Business & Organizational Strategy",
    ],
  },
];
