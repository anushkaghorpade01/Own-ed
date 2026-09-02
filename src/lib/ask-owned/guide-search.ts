import { searchGuide, type GuideSearchResult } from "@/lib/guide/search";

export type { GuideSearchResult };

/** Local guide search for Ask OWNED — no network. */
export function searchOwnedGuide(query: string, limit = 3): GuideSearchResult[] {
  return searchGuide(query).slice(0, limit);
}

export function guideHref(sectionId: string): string {
  return `/guide#${sectionId}`;
}
