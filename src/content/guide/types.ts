export type GuideCategory =
  | "Getting Started"
  | "Math"
  | "Workspace"
  | "Using Own-ed"
  | "Troubleshooting";

export interface GuideSection {
  id: string;
  title: string;
  category: GuideCategory;
  keywords: string[];
  aliases?: string[];
  /** Short bullets for "Pay attention to" style sections */
  payAttention?: string[];
  related?: { id: string; label: string }[];
  body: string[];
}

export interface GuideGroup {
  category: GuideCategory;
  sections: GuideSection[];
}

export const GUIDE_VERSION = "2026-09-02";
export const GUIDE_WORD_TARGET = "1,500–2,500 words";
