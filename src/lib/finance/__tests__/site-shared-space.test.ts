import { describe, expect, it } from "vitest";
import {
  SITE_SHARED_SPACE_IMAGES,
  sharedSpaceItemsForBoard,
  isSiteSharedSpaceItem,
} from "../site-shared-space";

describe("site shared space items", () => {
  it("includes Pinterest moodboard on Overall Mood", () => {
    const items = sharedSpaceItemsForBoard("Overall Mood");
    expect(items).toHaveLength(1);
    expect(items[0]?.sourceUrl).toBe("https://pin.it/2ip6LypFK");
    expect(items[0]?.itemType).toBe("link");
  });

  it("does not appear on other boards", () => {
    expect(sharedSpaceItemsForBoard("Lighting")).toHaveLength(0);
  });

  it("identifies shared ids", () => {
    const id = SITE_SHARED_SPACE_IMAGES[0]!.id;
    expect(isSiteSharedSpaceItem(id)).toBe(true);
    expect(isSiteSharedSpaceItem("user-space-1")).toBe(false);
  });
});
