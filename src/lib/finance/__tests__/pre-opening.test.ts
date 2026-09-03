import { describe, it, expect } from "vitest";
import { createSampleAssumptions } from "../sample-data";
import { runFinanceModel } from "../run-model";
import { calculateCapex } from "../engine/costs";
import {
  buildCapexPaymentSchedule,
  getFirstOperatingMonth,
  isPreOpeningMonth,
  toOperatingMonth,
} from "../engine/pre-opening";
import { getRampUpOccupancy } from "../engine/cash-flow";
import { buildLaunchCashBreakdown } from "../engine/investment-recovery";

function clone() {
  return structuredClone(createSampleAssumptions());
}

function cloneWithoutPackPresales() {
  const a = structuredClone(createSampleAssumptions());
  for (const p of a.products) {
    if (p.type === "credit_pack" && p.packRules) {
      p.packRules.expectedSalesVolumePerMonth = 0;
    }
  }
  return a;
}

describe("Pre-opening launch timeline", () => {
  it("with zero pre-opening months matches legacy capex timing (all month 1)", () => {
    const a = clone();
    a.preOpeningMonths = 0;
    const capex = calculateCapex(a);
    const schedule = buildCapexPaymentSchedule(a, capex);
    const month1 = schedule.get(1)!;
    expect(month1.nonRecoverable.toNumber()).toBe(capex.nonRecoverableCapex.toNumber());
    expect(month1.deposit.toNumber()).toBe(capex.recoverableDeposits.toNumber());
    expect(schedule.size).toBe(1);
  });

  it("spreads interior fit-out over pre-opening months and equipment at open", () => {
    const a = clone();
    a.preOpeningMonths = 2;
    a.capexInteriorFitout = 800_000;
    const capex = calculateCapex(a);
    const schedule = buildCapexPaymentSchedule(a, capex);

    expect(schedule.get(1)!.deposit.toNumber()).toBe(a.securityDepositAmount);
    expect(schedule.get(1)!.nonRecoverable.toNumber()).toBe(400_000);
    expect(schedule.get(2)!.nonRecoverable.toNumber()).toBe(400_000);
    const openMonth = getFirstOperatingMonth(a);
    expect(openMonth).toBe(3);
    const equipmentAtOpen = schedule.get(3)!.nonRecoverable.toNumber();
    expect(equipmentAtOpen).toBe(capex.nonRecoverableCapex.toNumber() - 800_000);
    expect(equipmentAtOpen).toBeGreaterThan(0);
  });

  it("keeps payback hurdle unchanged but lowers opening bank when fit-out is deferred", () => {
    const legacy = clone();
    legacy.preOpeningMonths = 0;
    const preOpen = clone();
    preOpen.preOpeningMonths = 2;

    const legacyLaunch = buildLaunchCashBreakdown(legacy, calculateCapex(legacy));
    const preLaunch = buildLaunchCashBreakdown(preOpen, calculateCapex(preOpen));

    expect(preLaunch.paybackInvestmentBase.toNumber()).toBe(
      legacyLaunch.paybackInvestmentBase.toNumber()
    );
    expect(preLaunch.openingBankCashAfterLaunch.gt(legacyLaunch.openingBankCashAfterLaunch)).toBe(
      true
    );
  });

  it("has zero occupancy and revenue during pre-opening months", () => {
    const a = clone();
    a.preOpeningMonths = 2;
    const model = runFinanceModel(a);

    expect(isPreOpeningMonth(a, 1)).toBe(true);
    expect(isPreOpeningMonth(a, 2)).toBe(true);
    expect(isPreOpeningMonth(a, 3)).toBe(false);

    expect(getRampUpOccupancy(a, 1).toNumber()).toBe(0);
    expect(getRampUpOccupancy(a, 2).toNumber()).toBe(0);
    expect(getRampUpOccupancy(a, 3).gt(0)).toBe(true);

    expect(model.monthlyProjection[0]!.pl.netRevenue.toNumber()).toBe(0);
    expect(model.monthlyProjection[1]!.pl.netRevenue.toNumber()).toBe(0);
    expect(model.monthlyProjection[2]!.pl.netRevenue.gt(0)).toBe(true);
  });

  it("offsets ramp-up to start after pre-opening", () => {
    const a = clone();
    a.preOpeningMonths = 2;
    a.rampUpStartingOccupancyPct = 30;
    a.rampUpMonthsToTarget = 12;

    expect(toOperatingMonth(a, 3)).toBe(1);
    expect(getRampUpOccupancy(a, 3).times(100).toNumber()).toBe(30);
    expect(getRampUpOccupancy(a, 2).toNumber()).toBe(0);
  });

  it("pre-opening months deepen early bank cash trough", () => {
    const legacy = {
      ...cloneWithoutPackPresales(),
      preOpeningMonths: 0,
      rampPackSalesMode: "steady" as const,
    };
    const preOpen = {
      ...cloneWithoutPackPresales(),
      preOpeningMonths: 2,
      rampPackSalesMode: "steady" as const,
    };

    const legacyHealth = runFinanceModel(legacy).cashFlow.cashHealth;
    const preHealth = runFinanceModel(preOpen).cashFlow.cashHealth;

    expect(preHealth.lowestBankCash.lt(legacyHealth.lowestBankCash)).toBe(true);
  });
});
