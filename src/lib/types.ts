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
  downvoted?: boolean;
  isUserUpload?: boolean;
  embedding?: number[]; // nomic-embed-text embedding for semantic similarity
  bookmarked?: boolean;
  imageUrl?: string; // served from /api/paper-images/... when figure was extracted
  groundingData?: {
    card_verified: boolean;
    claims: { claim: string; entailment_score: number; passed: boolean }[];
    summary: string;
  } | null;
}

export interface Comment {
  id: string;
  paperId: string;
  userPostId?: string | null;
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
  mode: string;
  aiProvider?: "ollama" | "cloudflare" | null;
  status?: "generating" | "complete" | "error";
  pdfKeys?: string[];
}

export interface OnboardingPreset {
  topic: string;
  description: string;
  subfields: string[];
}

// ── Literature Review Export ──

export type PaperTier = "core" | "supporting" | "peripheral";

export interface ScoredPaper {
  id: string;
  title: string;
  authors: string[];
  year: number;
  synthesis: string;
  apaCitation: string;
  doi: string;
  credibilityScore: number;
  citationCount: number;
  engagementScore: number;
  tier: PaperTier;
  signals: {
    upvoted: boolean;
    downvoted: boolean;
    bookmarked: boolean;
    userCommentCount: number;
  };
}

export interface LitReviewSection {
  title: string;
  content: string;
  papers: Array<{ title: string; tier: PaperTier; apaCitation: string }>;
}

export interface LitReviewExport {
  introduction: string;
  sections: LitReviewSection[];
  conclusion: string;
  references: Array<{ apaCitation: string; tier: PaperTier }>;
}
