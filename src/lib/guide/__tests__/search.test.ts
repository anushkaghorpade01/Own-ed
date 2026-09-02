import { describe, it, expect } from "vitest";
import { searchGuide } from "@/lib/guide/search";
import { ALL_GUIDE_SECTIONS, getGuideSection } from "@/content/guide";

describe("Guide search", () => {
  it("finds cash-related sections", () => {
    const results = searchGuide("cash");
    const ids = results.map((r) => r.section.id);
    expect(ids).toContain("cash-flow");
    expect(ids.some((id) => ["payback", "saving", "dont-confuse"].includes(id))).toBe(true);
  });

  it("finds private pricing", () => {
    const results = searchGuide("private");
    expect(results.some((r) => r.section.id === "pricing")).toBe(true);
  });

  it("finds occupancy via capacity", () => {
    const results = searchGuide("occupancy");
    expect(results.some((r) => r.section.id === "capacity")).toBe(true);
  });

  it("finds 8-pack pricing", () => {
    const results = searchGuide("8-pack");
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.some((r) =>
        ["pricing", "credits", "access-products"].includes(r.section.id)
      )
    ).toBe(true);
  });

  it("finds profit target via alias", () => {
    const results = searchGuide("profit target");
    expect(results.some((r) => r.section.id === "sales-client-target")).toBe(true);
  });

  it("finds profit views section", () => {
    const results = searchGuide("different profit");
    expect(results.some((r) => r.section.id === "profit-views")).toBe(true);
  });

  it("finds brand and space via pictures alias", () => {
    const results = searchGuide("pictures");
    const ids = results.map((r) => r.section.id);
    expect(ids).toContain("brand");
    expect(ids).toContain("space");
  });

  it("finds clients via alias map", () => {
    const results = searchGuide("clients");
    expect(results.some((r) => r.section.id === "sales-client-target")).toBe(true);
  });

  it("returns empty for nonsense query", () => {
    expect(searchGuide("xyzqwerty123").length).toBe(0);
  });

  it("every section has stable id and content", () => {
    const ids = new Set<string>();
    for (const section of ALL_GUIDE_SECTIONS) {
      expect(section.id).toMatch(/^[a-z0-9-]+$/);
      expect(section.body.length).toBeGreaterThan(0);
      expect(ids.has(section.id)).toBe(false);
      ids.add(section.id);
    }
    expect(getGuideSection("capacity")).toBeDefined();
    expect(getGuideSection("not-a-section")).toBeUndefined();
  });
});
