import { describe, it, expect } from "vitest";
import {
  FINANCE_DICTIONARY,
  searchDictionary,
} from "../finance-dictionary";

describe("finance dictionary", () => {
  it("includes CM1, fully loaded, and net sales", () => {
    const terms = FINANCE_DICTIONARY.map((e) => e.term.toLowerCase());
    expect(terms.some((t) => t.includes("cm1"))).toBe(true);
    expect(terms.some((t) => t.includes("fully loaded"))).toBe(true);
    expect(terms.some((t) => t.includes("net sales"))).toBe(true);
  });

  it("search finds aliases", () => {
    const results = searchDictionary("gross price");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].term).toContain("Customer pays");
  });

  it("has entries in every category", () => {
    const categories = new Set(FINANCE_DICTIONARY.map((e) => e.category));
    expect(categories.has("pricing")).toBe(true);
    expect(categories.has("margin")).toBe(true);
    expect(categories.has("profit")).toBe(true);
    expect(categories.has("capacity")).toBe(true);
  });
});
