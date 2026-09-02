import type { BrandItem } from "./schemas";

/** Site-wide Brand references — shipped with the app, visible to every visitor. */
export const SITE_SHARED_BRAND_ITEMS: BrandItem[] = [
  {
    id: "site-shared-own-hq-notion",
    type: "link",
    title: "OWN HQ (Notion)",
    description:
      "Team workspace for ideas, software issues, brand notes, and planning. Anyone with access can add and edit.",
    sourceUrl:
      "https://app.notion.com/p/OWN-HQ-6102eb2d027840419e769b8a07ce46d8?source=copy_link",
    tags: ["notion", "workspace"],
    status: "active",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  },
];

export function isSiteSharedBrandItem(id: string): boolean {
  return SITE_SHARED_BRAND_ITEMS.some((item) => item.id === id);
}
