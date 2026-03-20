import type { CitationComment, UserComment } from "@/lib/types";

export const citationComments: CitationComment[] = [
  // Paper p1 - Judgment Under Uncertainty
  {
    id: "cc1",
    paperId: "p1",
    authorName: "Gerd Gigerenzer",
    peerReviewed: true,
    relationship: "challenges",
    synthesis:
      "Gigerenzer argues that heuristics are not merely sources of bias but evolved tools that enable fast and frugal decision-making. In ecological contexts, simple heuristics can outperform complex rational models.",
    journal: "Psychological Review",
    year: 1996,
  },
  {
    id: "cc2",
    paperId: "p1",
    authorName: "Paul Slovic",
    peerReviewed: true,
    relationship: "extends",
    synthesis:
      "Slovic extends the heuristics framework by introducing the affect heuristic\u2014demonstrating that emotional reactions serve as cues for judgment, operating alongside the cognitive heuristics identified by Kahneman and Tversky.",
    journal: "European Journal of Operational Research",
    year: 2007,
  },
  {
    id: "cc3",
    paperId: "p1",
    authorName: "Keith E. Stanovich",
    peerReviewed: true,
    relationship: "supports",
    synthesis:
      "Stanovich\u2019s research on individual differences in heuristic use confirms the core findings, showing that cognitive ability moderates susceptibility to bias but does not eliminate it. Even highly intelligent individuals fall prey to heuristic-driven errors.",
    journal: "Current Directions in Psychological Science",
    year: 2000,
  },
  // Paper p2 - Prospect Theory
  {
    id: "cc4",
    paperId: "p2",
    authorName: "Richard H. Thaler",
    peerReviewed: true,
    relationship: "extends",
    synthesis:
      "Thaler\u2019s work on mental accounting builds directly on prospect theory, showing that people organize financial outcomes into separate mental accounts and evaluate gains and losses within these narrow frames.",
    journal: "Journal of Behavioral Decision Making",
    year: 1999,
  },
  {
    id: "cc5",
    paperId: "p2",
    authorName: "Nicholas Barberis",
    peerReviewed: true,
    relationship: "supports",
    synthesis:
      "Barberis demonstrates that prospect theory\u2019s loss aversion and probability weighting successfully predict anomalies in stock market returns that standard expected utility theory cannot explain.",
    journal: "Journal of Finance",
    year: 2013,
  },
  // Paper p3 - Thinking Fast and Slow
  {
    id: "cc6",
    paperId: "p3",
    authorName: "Jonathan St. B. T. Evans",
    peerReviewed: true,
    relationship: "challenges",
    synthesis:
      "Evans argues that the System 1/System 2 dichotomy oversimplifies dual-process theory. Multiple Type 1 processes exist with different characteristics, and the boundary between automatic and deliberate processing is more fluid than Kahneman suggests.",
    journal: "Perspectives on Psychological Science",
    year: 2008,
  },
  {
    id: "cc7",
    paperId: "p3",
    authorName: "Magda Osman",
    peerReviewed: true,
    relationship: "extends",
    synthesis:
      "Osman proposes that System 2 engagement depends on metacognitive monitoring\u2014people switch to deliberate processing when they detect a conflict between intuitive responses and task demands.",
    journal: "Psychological Bulletin",
    year: 2004,
  },
  // Paper p5 - Cognitive Reflection
  {
    id: "cc8",
    paperId: "p5",
    authorName: "Gordon Pennycook",
    peerReviewed: true,
    relationship: "extends",
    synthesis:
      "Pennycook extends Frederick\u2019s work by linking cognitive reflection to susceptibility to fake news and misinformation, showing that analytical thinkers are better at distinguishing real from fabricated news headlines.",
    journal: "Cognition",
    year: 2019,
  },
  // Paper p6 - Nudge
  {
    id: "cc9",
    paperId: "p6",
    authorName: "Shlomo Benartzi",
    peerReviewed: true,
    relationship: "supports",
    synthesis:
      "Benartzi\u2019s Save More Tomorrow program is a direct application of nudge theory in retirement savings, demonstrating that default enrollment and automatic escalation dramatically increase savings rates.",
    journal: "Journal of Political Economy",
    year: 2004,
  },
  {
    id: "cc10",
    paperId: "p6",
    authorName: "Luc Bovens",
    peerReviewed: true,
    relationship: "challenges",
    synthesis:
      "Bovens raises ethical concerns about nudging, arguing that manipulating choice architecture without full transparency undermines individual autonomy and can serve paternalistic agendas disguised as benevolent design.",
    journal: "European Journal of Risk Regulation",
    year: 2009,
  },
  // Paper p8 - Confirmation Bias
  {
    id: "cc11",
    paperId: "p8",
    authorName: "Hugo Mercier",
    peerReviewed: true,
    relationship: "challenges",
    synthesis:
      "Mercier proposes that confirmation bias is not a flaw but an evolved feature of argumentative reasoning. In group discussion contexts, each person\u2019s bias toward their own position creates productive argumentation that improves collective outcomes.",
    journal: "Behavioral and Brain Sciences",
    year: 2011,
  },
  {
    id: "cc12",
    paperId: "p8",
    authorName: "Peter C. Wason",
    peerReviewed: true,
    relationship: "supports",
    synthesis:
      "Wason\u2019s original selection task experiments provide foundational evidence for confirmation bias, showing that people consistently seek evidence that confirms rather than falsifies their hypotheses.",
    journal: "Quarterly Journal of Experimental Psychology",
    year: 1968,
  },
  // Paper p10 - Bounded Rationality
  {
    id: "cc13",
    paperId: "p10",
    authorName: "Reinhard Selten",
    peerReviewed: true,
    relationship: "extends",
    synthesis:
      "Selten builds on Simon\u2019s bounded rationality by developing aspiration adaptation theory, where decision-makers adjust their aspiration levels based on experience rather than performing optimization calculations.",
    journal: "Journal of Mathematical Psychology",
    year: 1998,
  },
  {
    id: "cc14",
    paperId: "p10",
    authorName: "Daniel Kahneman",
    peerReviewed: true,
    relationship: "supports",
    synthesis:
      "Kahneman\u2019s work on heuristics and biases provides extensive empirical support for Simon\u2019s theory, documenting the specific mechanisms through which bounded rationality manifests in everyday judgment.",
    journal: "American Economic Review",
    year: 2003,
  },
  // Paper p12 - Sunk Cost
  {
    id: "cc15",
    paperId: "p12",
    authorName: "Richard H. Thaler",
    peerReviewed: true,
    relationship: "supports",
    synthesis:
      "Thaler\u2019s research on mental accounting confirms the sunk cost effect, showing that people are more likely to attend a paid event in bad weather because the ticket represents a mental account that must be \u2018closed\u2019 by usage.",
    journal: "Marketing Science",
    year: 1985,
  },
];

export const userComments: UserComment[] = [
  {
    id: "uc1",
    paperId: "p1",
    userMessage:
      "How do these heuristics apply to students making academic decisions, like choosing a major or research topic?",
    aiReply:
      "Based on our research, the availability heuristic plays a significant role in academic decisions. Students tend to overweight information that is easily recalled\u2014such as a friend\u2019s experience in a particular major\u2014while underweighting base-rate statistics about career outcomes. The representativeness heuristic can lead students to choose topics that \u2018feel\u2019 like good research without evaluating whether they\u2019re tractable or well-supported by existing literature.",
    aiReplyAuthor: "Daniel Kahneman",
  },
  {
    id: "uc2",
    paperId: "p2",
    userMessage:
      "Is loss aversion universal across cultures, or is it primarily a Western phenomenon?",
    aiReply:
      "While our original studies were conducted primarily with Western participants, subsequent cross-cultural research suggests that loss aversion is remarkably universal, though its magnitude varies. Studies in East Asian populations show similar patterns, but the reference points around which gains and losses are evaluated can differ significantly based on cultural norms around wealth and risk-taking.",
    aiReplyAuthor: "Amos Tversky",
  },
  {
    id: "uc3",
    paperId: "p6",
    userMessage:
      "Could nudging be applied effectively in educational settings to improve student outcomes?",
    aiReply:
      "Absolutely. Default enrollment in tutoring programs, strategic placement of study resources, and simplified financial aid applications are all examples of educational nudges that have shown measurable effects. The key principle is reducing friction for beneficial behaviors while maintaining freedom of choice. However, transparency about these design choices is important to maintain trust.",
    aiReplyAuthor: "Richard H. Thaler",
  },
  {
    id: "uc4",
    paperId: "p3",
    userMessage:
      "How can I train myself to engage System 2 more often when making important decisions?",
    aiReply:
      "The most effective strategy is to create environmental cues that trigger deliberation. When facing important decisions, introduce a mandatory waiting period before committing. Use structured decision frameworks\u2014writing down pros and cons, considering the opposite perspective, or explaining your reasoning to someone else. These techniques don\u2019t eliminate System 1\u2019s influence but create checkpoints where System 2 can intervene.",
    aiReplyAuthor: "Daniel Kahneman",
  },
  {
    id: "uc5",
    paperId: "p8",
    userMessage:
      "How does confirmation bias affect academic research itself? Can researchers be biased in their own studies?",
    aiReply:
      "Confirmation bias is perhaps most insidious in research contexts. Researchers may unconsciously design studies that favor their hypotheses, interpret ambiguous data as supportive, selectively cite confirming studies, and file away disconfirming results. Pre-registration of hypotheses and analysis plans, adversarial collaborations, and rigorous peer review are institutional safeguards, but the bias remains a persistent challenge in science.",
    aiReplyAuthor: "Raymond S. Nickerson",
  },
];
