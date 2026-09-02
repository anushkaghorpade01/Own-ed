import { describe, it, expect } from "vitest";
import { createSampleAssumptions } from "../sample-data";
import { normalizeAssumptions } from "../validation";
import { runFinanceModel } from "../run-model";

describe("normalizeAssumptions", () => {
  it("fills missing private/duo fields from saved partial state", () => {
    const sample = createSampleAssumptions();
    const legacy = { ...sample } as Record<string, unknown>;
    delete legacy.privateDurationMinutes;
    delete legacy.duoDurationMinutes;

    const normalized = normalizeAssumptions(legacy, sample);
    expect(normalized.privateDurationMinutes).toBe(55);
    expect(normalized.duoDurationMinutes).toBe(55);
  });

  it("treats JSON null as missing so schema defaults apply", () => {
    const sample = createSampleAssumptions();
    const legacy = {
      ...sample,
      privateDurationMinutes: null,
      duoReformersConsumed: null,
    } as unknown as typeof sample;

    const normalized = normalizeAssumptions(legacy, sample);
    expect(normalized.privateDurationMinutes).toBe(55);
    expect(normalized.duoReformersConsumed).toBe(2);
  });

  it("allows runFinanceModel on legacy assumptions without crashing", () => {
    const sample = createSampleAssumptions();
    const legacy = { ...sample } as Record<string, unknown>;
    delete legacy.privateDurationMinutes;
    delete legacy.duoDurationMinutes;
    delete legacy.privateReformersOccupied;

    expect(() => runFinanceModel(legacy as typeof sample)).not.toThrow();
  });
});
