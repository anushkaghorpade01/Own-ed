import type { SpaceImage } from "./schemas";

/** Site-wide Space references — shipped with the app, visible to every visitor. */
export const SITE_SHARED_SPACE_IMAGES: SpaceImage[] = [
  {
    id: "site-shared-overall-mood-pinterest",
    board: "Overall Mood",
    category: "Overall Mood",
    title: "OWN Pinterest moodboard",
    sourceUrl: "https://pin.it/2ip6LypFK",
    itemType: "link",
    tags: ["pinterest", "moodboard"],
    notes: "Visual references for the studio — open on Pinterest.",
    isSample: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  },
];

export function sharedSpaceItemsForBoard(board: string): SpaceImage[] {
  return SITE_SHARED_SPACE_IMAGES.filter((item) => item.board === board);
}

export function isSiteSharedSpaceItem(id: string): boolean {
  return SITE_SHARED_SPACE_IMAGES.some((item) => item.id === id);
}
