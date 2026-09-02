import { describe, it, expect } from "vitest";
import { defaultAppState } from "@/lib/store/default-state";
import { searchGlobal, groupSearchResults } from "@/lib/search/global-search-index";

describe("Global search index", () => {
  const state = defaultAppState();

  it("finds capacity and assumptions for occupancy", () => {
    const results = searchGlobal("occupancy", state);
    const titles = results.map((r) => r.title);
    expect(titles).toContain("Capacity");
    expect(titles.some((t) => t.includes("occupancy") || t === "Assumptions")).toBe(true);
  });

  it("finds P&L for profit", () => {
    const results = searchGlobal("profit", state);
    expect(results.some((r) => r.href === "/math/pl")).toBe(true);
  });

  it("finds guide sections", () => {
    const results = searchGlobal("cash", state);
    expect(results.some((r) => r.category === "Guide")).toBe(true);
  });

  it("finds dictionary terms", () => {
    const results = searchGlobal("ebitda", state);
    expect(results.some((r) => r.category === "Dictionary")).toBe(true);
  });

  it("finds assumption fields", () => {
    const results = searchGlobal("rent", state);
    expect(results.some((r) => r.category === "Assumption" && r.title === "Rent")).toBe(true);
    expect(results.some((r) => r.href === "/math/assumptions")).toBe(true);
  });

  it("groups results by category", () => {
    const results = searchGlobal("occupancy", state);
    const groups = groupSearchResults(results);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0]!.category).toBe("Page");
  });

  it("returns empty for blank query", () => {
    expect(searchGlobal("", state)).toHaveLength(0);
  });
});
