import { describe, it, expect } from "vitest";
import { migrateLegacyAppState } from "@/lib/data/migration/local-to-normalized";
import { createSampleAssumptions } from "@/lib/finance/sample-data";

describe("localStorage migration", () => {
  it("normalizes assumptions blob into products + pack rules", () => {
    const assumptions = createSampleAssumptions();
    const legacyActions = [
      {
        id: "legacy-action-1",
        title: "Review rent scenario",
        completed: false,
        createdAt: new Date().toISOString(),
      },
    ];
    const { data, flags } = migrateLegacyAppState({
      assumptions,
      actions: legacyActions,
      questions: [],
    });
    expect(data.products.length).toBeGreaterThanOrEqual(3);
    expect(data.packRules.length).toBeGreaterThan(0);
    expect(data.roadmap.length).toBe(legacyActions.length);
    expect(flags.some((f) => f.entity === "actions")).toBe(true);
  });

  it("preserves product IDs", () => {
    const assumptions = createSampleAssumptions();
    const { data } = migrateLegacyAppState({ assumptions });
    expect(data.products.some((p) => p.id === "8-pack")).toBe(true);
  });
});
