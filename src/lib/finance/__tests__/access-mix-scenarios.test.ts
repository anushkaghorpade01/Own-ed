import { describe, it, expect } from "vitest";
import { createSampleAssumptions } from "../sample-data";
import { runFinanceModel } from "../run-model";

describe("Scenario Analysis access mix tab", () => {
  const mixes = [
    { name: "100% flexible", mix: { flexiblePackPct: 100, standingSpotPct: 0, dropInPct: 0, standbyPct: 0, privateDuoPct: 0, trialPct: 0 } },
    { name: "70% flex / 20% SS / 10% drop-in", mix: { flexiblePackPct: 70, standingSpotPct: 20, dropInPct: 10, standbyPct: 0, privateDuoPct: 0, trialPct: 0 } },
    { name: "65% flex / 15% SS / 10% drop-in / 10% standby", mix: { flexiblePackPct: 65, standingSpotPct: 15, dropInPct: 10, standbyPct: 10, privateDuoPct: 0, trialPct: 0 } },
  ];

  it("current implementation: identical when SS/standby disabled (sample defaults)", () => {
    const base = createSampleAssumptions();
    const results = mixes.map(({ mix }) => {
      const model = runFinanceModel({ ...base, accessProductMix: mix });
      return model.pl.ebitda.toNumber();
    });
    expect(results[0]).toBe(results[1]);
    expect(results[1]).toBe(results[2]);
  });

  it("would differ if standing spot and standby were enabled for mixed rows", () => {
    const base = createSampleAssumptions();
    const withFeatures = mixes.map(({ mix }) => {
      const model = runFinanceModel({
        ...base,
        accessProductMix: mix,
        standingSpotEnabled: mix.standingSpotPct > 0,
        standbyEnabled: mix.standbyPct > 0,
      });
      return model.pl.ebitda.toNumber();
    });
    expect(withFeatures[0]).not.toBe(withFeatures[1]);
  });
});
