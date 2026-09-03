import { describe, it, expect } from "vitest";
import { createSampleAssumptions } from "../sample-data";
import { calculatePrepaidPackCash } from "../engine/prepaid-cash";
import { runFinanceModel } from "../run-model";
import { ensureProductVersionFields } from "../engine/product-catalog";
import { getFirstOperatingMonth } from "../engine/pre-opening";

describe("Prepaid cash model", () => {
  it("collects full gross pack price at purchase, not redemption timing", () => {
    const eightPack = ensureProductVersionFields({
      id: "8-pack-test",
      name: "8-Pack",
      type: "credit_pack",
      price: 13559,
      gstTreatment: "exclusive",
      gstFollowsGlobal: true,
      creditsIncluded: 8,
      packageMixPct: 100,
      peakEligible: true,
      recurring: false,
      discountPct: 0,
      classEligibility: [],
      standingSpotMaxSeatsPerClass: 1,
      packRules: {
        validityValue: 8,
        validityUnit: "weeks",
        validityBeginsFrom: "activation",
        activationDeadlineDays: 30,
        activationPolicy: "expire_if_not_activated",
        eligibleClassTypes: [],
        eligibleTimeBands: ["peak", "standard", "off_peak"],
        expectedRedemptionRatePct: 100,
        expectedBreakageRatePct: 0,
        expectedCancellationRatePct: 0,
        expectedNoShowRatePct: 0,
        expectedPeakBookingSharePct: 50,
        transferable: false,
        refundable: false,
        expectedSalesVolumePerMonth: 1,
        active: true,
        displayOrder: 1,
      },
    });

    const assumptions = {
      ...createSampleAssumptions(),
      products: [eightPack],
    };

    const prepaid = calculatePrepaidPackCash(assumptions);
    expect(prepaid.grossCashCollected.toNumber()).toBeCloseTo(16000, 0);

    const model = runFinanceModel(assumptions);
    expect(model.cashFlow.inflowBasis).toBe("prepaid_pack_purchase_cash");
    const firstOp = getFirstOperatingMonth(assumptions);
    const firstOpRow = model.cashFlow.monthly.find((m) => m.month === firstOp)!;
    expect(firstOpRow.cashInflows.toNumber()).toBeGreaterThanOrEqual(16000);
  });
});
