import { describe, it, expect } from "vitest";
import { createSampleAssumptions } from "@/lib/finance/sample-data";
import { normalizeAssumptions } from "@/lib/finance/validation";
import { runFinanceModel } from "@/lib/finance/run-model";

describe("Salaried-only instructor model", () => {
  it("clears legacy per-class instructor fields on normalize", () => {
    const normalized = normalizeAssumptions({
      ...createSampleAssumptions(),
      instructorPerClassPayout: 500,
      instructorPerAttendeePayout: 25,
    });
    expect(normalized.instructorPerClassPayout).toBe(0);
    expect(normalized.instructorPerAttendeePayout).toBe(0);
  });

  it("does not book instructor delivery on direct costs when salaried only", () => {
    const model = runFinanceModel(createSampleAssumptions());
    expect(model.directCosts.variableInstructorPayouts.toNumber()).toBe(0);
  });
});
