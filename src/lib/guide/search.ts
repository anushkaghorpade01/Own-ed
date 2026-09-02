import { ALL_GUIDE_SECTIONS, type GuideSection } from "@/content/guide";

export interface GuideSearchResult {
  section: GuideSection;
  score: number;
  snippet: string;
  matchField: "title" | "keyword" | "alias" | "body";
}

/** Manual aliases → section ids for plain-language search */
const ALIAS_MAP: Record<string, string[]> = {
  money: ["pl", "cash-flow", "sales-client-target"],
  clients: ["sales-client-target", "sales-vs-clients"],
  classes: ["capacity", "credits", "service-demand-mix"],
  investment: ["payback", "assumptions"],
  pictures: ["brand", "space"],
  photos: ["brand", "space"],
  signup: ["sales-client-target", "sales-vs-clients"],
  signups: ["sales-client-target", "sales-vs-clients"],
  private: ["pricing", "service-demand-mix", "unit-economics"],
  "8 pack": ["pricing", "credits", "access-products"],
  "16 pack": ["pricing", "credits", "access-products"],
  "profit target": ["sales-client-target"],
  bank: ["cash-flow"],
  save: ["saving", "backups"],
  backup: ["backups", "saving"],
  gst: ["pricing", "dont-confuse"],
  optimise: ["optimise"],
  optimize: ["optimise"],
};

function normalize(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, " ");
}

function snippetFromBody(body: string[], query: string): string {
  const q = normalize(query);
  for (const para of body) {
    const lower = para.toLowerCase();
    const idx = lower.indexOf(q);
    if (idx >= 0) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(para.length, idx + q.length + 60);
      return (start > 0 ? "…" : "") + para.slice(start, end) + (end < para.length ? "…" : "");
    }
  }
  return (body[0]?.slice(0, 120) ?? "") + (body[0] && body[0].length > 120 ? "…" : "");
}

function scoreSection(section: GuideSection, query: string): GuideSearchResult | null {
  const q = normalize(query);
  if (!q) return null;

  const titleLower = section.title.toLowerCase();
  const keywords = section.keywords.map((k) => k.toLowerCase());
  const aliases = (section.aliases ?? []).map((a) => a.toLowerCase());
  const bodyText = section.body.join(" ").toLowerCase();

  if (titleLower === q) {
    return {
      section,
      score: 100,
      snippet: section.body[0] ?? "",
      matchField: "title",
    };
  }
  if (titleLower.includes(q)) {
    return {
      section,
      score: 90,
      snippet: section.body[0] ?? "",
      matchField: "title",
    };
  }
  if (keywords.some((k) => k === q || k.includes(q))) {
    return {
      section,
      score: 80,
      snippet: snippetFromBody(section.body, q),
      matchField: "keyword",
    };
  }
  if (aliases.some((a) => a.includes(q) || q.includes(a))) {
    return {
      section,
      score: 75,
      snippet: snippetFromBody(section.body, q),
      matchField: "alias",
    };
  }
  if (bodyText.includes(q)) {
    return {
      section,
      score: 50,
      snippet: snippetFromBody(section.body, q),
      matchField: "body",
    };
  }
  return null;
}

export function searchGuide(query: string): GuideSearchResult[] {
  const q = normalize(query);
  if (!q) return [];

  const byId = new Map<string, GuideSearchResult>();

  for (const section of ALL_GUIDE_SECTIONS) {
    const hit = scoreSection(section, q);
    if (hit) byId.set(section.id, hit);
  }

  // Alias map boosts
  for (const [alias, ids] of Object.entries(ALIAS_MAP)) {
    if (alias.includes(q) || q.includes(alias)) {
      for (const id of ids) {
        const section = ALL_GUIDE_SECTIONS.find((s) => s.id === id);
        if (!section) continue;
        const existing = byId.get(id);
        if (!existing || existing.score < 70) {
          byId.set(id, {
            section,
            score: existing ? existing.score + 15 : 70,
            snippet: existing?.snippet ?? section.body[0] ?? "",
            matchField: "alias",
          });
        }
      }
    }
  }

  return [...byId.values()].sort((a, b) => b.score - a.score);
}

/** Highlight query in text — returns parts for rendering */
export function highlightParts(
  text: string,
  query: string
): Array<{ text: string; highlight: boolean }> {
  const q = normalize(query);
  if (!q || !text) return [{ text, highlight: false }];

  const lower = text.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0) return [{ text, highlight: false }];

  const parts: Array<{ text: string; highlight: boolean }> = [];
  if (idx > 0) parts.push({ text: text.slice(0, idx), highlight: false });
  parts.push({ text: text.slice(idx, idx + q.length), highlight: true });
  if (idx + q.length < text.length) {
    parts.push({ text: text.slice(idx + q.length), highlight: false });
  }
  return parts;
}
