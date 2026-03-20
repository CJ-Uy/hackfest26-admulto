export interface Paper {
  id: string;
  title: string;
  authors: string[];
  journal: string;
  year: number;
  doi: string;
  peerReviewed: boolean;
  synthesis: string;
  credibilityScore: number;
  citationCount: number;
  commentCount: number;
  apaCitation: string;
}

export interface CitationComment {
  id: string;
  paperId: string;
  authorName: string;
  peerReviewed: boolean;
  relationship: "supports" | "challenges" | "extends";
  synthesis: string;
  journal: string;
  year: number;
}

export interface UserComment {
  id: string;
  paperId: string;
  userMessage: string;
  aiReply: string;
  aiReplyAuthor: string;
}

export interface Poll {
  id: string;
  type: "multiple-choice" | "open-ended";
  question: string;
  options?: string[];
}

export interface ExportSource {
  title: string;
  authors: string;
  year: number;
  keyFinding: string;
  apaCitation: string;
}

export interface ExportTheme {
  title: string;
  summary: string;
  sources: ExportSource[];
}

export interface ScrollSession {
  id: string;
  title: string;
  description: string;
  date: string;
  paperCount: number;
  mode: "brainstorm" | "citation-finder";
}

export interface OnboardingPreset {
  topic: string;
  description: string;
  subfields: string[];
}
