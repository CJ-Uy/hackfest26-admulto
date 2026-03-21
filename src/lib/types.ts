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
  voted?: boolean;
}

export interface Comment {
  id: string;
  paperId: string;
  parentId?: string | null;
  content: string;
  author: string;
  createdAt: string;
  isGenerated: boolean;
  relationship?:
    | "agrees"
    | "disagrees"
    | "extends"
    | "cites"
    | "questions"
    | "responds"
    | null;
}

export interface UserPost {
  id: string;
  content: string;
  title?: string;
  commentCount: number;
  createdAt: string;
}

export interface Poll {
  id: string;
  type: "multiple-choice" | "open-ended";
  question: string;
  options?: string[];
  selectedAnswer?: string;
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
  status?: "generating" | "complete" | "error";
}

export interface OnboardingPreset {
  topic: string;
  description: string;
  subfields: string[];
}
