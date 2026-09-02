import { describe, expect, it } from "vitest";
import { SITE_SHARED_BRAND_ITEMS, isSiteSharedBrandItem } from "../site-shared-brand";

describe("site shared brand items", () => {
  it("includes OWN HQ Notion workspace link", () => {
    expect(SITE_SHARED_BRAND_ITEMS).toHaveLength(1);
    expect(SITE_SHARED_BRAND_ITEMS[0]?.title).toBe("OWN HQ (Notion)");
    expect(SITE_SHARED_BRAND_ITEMS[0]?.sourceUrl).toContain("OWN-HQ-6102eb2d027840419e769b8a07ce46d8");
  });

  it("identifies shared brand ids", () => {
    const id = SITE_SHARED_BRAND_ITEMS[0]!.id;
    expect(isSiteSharedBrandItem(id)).toBe(true);
    expect(isSiteSharedBrandItem("brand-user-1")).toBe(false);
  });
});
