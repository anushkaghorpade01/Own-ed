/**
 * Flexible credit pack economics — quantity + validity products.
 * Not monthly allocations. Supports arbitrary pack sizes via Product + packRules.
 */
import Decimal from "decimal.js";
import { d, trace, WEEKS_PER_MONTH, type CalculationTrace } from "../decimal";
import type { FinanceAssumptions, Product, FlexiblePackRules, ValidityPreset } from "../schemas";
import { VALIDITY_PRESETS } from "../schemas";
import { getActiveProducts } from "./product-catalog";
import { calculateFlexibleCreditMix } from "./flexible-mix";
import { deriveExpectedFutureRedemptions } from "./credit-ledger";
import {
  productGrossPrice,
  productNetPrice,
} from "./product-pricing";
import {
  contributionPerSession,
  paymentFeeOnNet,
  variableCostPerAttendedSeat,
} from "./contribution";

export const FLEXIBLE_PACK_FORMULAS = {
  netPerCredit: "net sales after GST ÷ credits sold",
  netSalesFromPack: "full net package value at purchase (planning model)",
  expectedContribution: "net sales − expected delivery variable costs",
  contributionPerRedeemed: "expected contribution ÷ expected credits redeemed",
  /** @deprecated planning model uses full net sales */
  expectedEarnedRevenue: "same as net sales from pack",
  /** @deprecated not used in founder planning model */
  deferredRevenue: "always zero in planning model",
} as const;

export interface FlexiblePackEconomics {
  productId: string;
  name: string;
  credits: number;
  validityWeeks: Decimal;
  grossPrice: Decimal;
  netPackageValue: Decimal;
  taxCollected: Decimal;
  netCashCollected: Decimal;
  grossPerCredit: Decimal;
  netPerCredit: Decimal;
  expectedCreditsRedeemed: Decimal;
  expectedCreditsExpired: Decimal;
  expectedCreditsForfeited: Decimal;
  expectedCreditsRemaining: Decimal;
  /** Credits not expected to be redeemed — capacity not consumed */
  expectedCreditsUnused: Decimal;
  expectedRedemptionPct: Decimal;
  expectedBreakagePct: Decimal;
  expectedEarnedRevenue: Decimal;
  deferredUnearnedRevenue: Decimal;
  expectedVariableCost: Decimal;
  expectedContribution: Decimal;
  contributionMarginPct: Decimal;
  expectedReformerSessions: Decimal;
  expectedPeakSessions: Decimal;
  expectedOffPeakSessions: Decimal;
  expectedWeeksToFullRedemption: Decimal;
  expectedOutstandingCreditDurationWeeks: Decimal;
  expiryCliffRiskPct: Decimal;
  plainEnglishSummary: string;
  traces: Record<string, CalculationTrace>;
}

export function isFlexiblePack(product: Product): boolean {
  return product.type === "credit_pack" || product.type === "drop_in";
}

export function resolvePackRules(product: Product): FlexiblePackRules {
  if (product.packRules) return product.packRules;

  const validityDays = product.validityDays ?? 28;
  const validityWeeks = Math.max(1, Math.round(validityDays / 7));

  return {
    validityValue: validityWeeks,
    validityUnit: "weeks",
    validityBeginsFrom: "activation",
    activationDeadlineDays: 30,
    activationPolicy: "expire_if_not_activated",
    eligibleClassTypes: product.classEligibility,
    eligibleTimeBands: product.peakEligible ? ["peak", "standard", "off_peak"] : ["standard", "off_peak"],
    expectedRedemptionRatePct: product.expectedRedemptionRatePct ?? 90,
    expectedBreakageRatePct: product.expectedBreakagePct ?? 10,
    expectedCancellationRatePct: 5,
    expectedNoShowRatePct: 3,
    expectedPeakBookingSharePct: 50,
    transferable: false,
    refundable: false,
    expectedSalesVolumePerMonth: 0,
    active: true,
    displayOrder: 0,
  };
}

export function validityInWeeks(rules: FlexiblePackRules): Decimal {
  switch (rules.validityUnit) {
    case "days":
      return d(rules.validityValue).dividedBy(7);
    case "months":
      return d(rules.validityValue).times(52).dividedBy(12);
    default:
      return d(rules.validityValue);
  }
}

function defaultRedemptionCurve(weeks: number, totalCredits: number): number[] {
  if (weeks <= 0) return [100];
  const curve: number[] = [];
  let remaining = 100;
  for (let w = 0; w < weeks; w++) {
    const isLast = w === weeks - 1;
    const share = isLast
      ? remaining
      : Math.round(remaining / (weeks - w) * (w < weeks / 2 ? 1.1 : 0.9));
    const clamped = Math.min(Math.max(share, 0), remaining);
    curve.push(clamped);
    remaining -= clamped;
  }
  if (remaining > 0 && curve.length > 0) curve[curve.length - 1] += remaining;
  return curve;
}

export function getRedemptionCurvePctByWeek(
  product: Product,
  assumptions: FinanceAssumptions
): number[] {
  const rules = resolvePackRules(product);
  const validityWeeks = validityInWeeks(rules);
  const weeks = Math.max(1, Math.ceil(validityWeeks.toNumber()));
  if (rules.redemptionCurvePctByWeek && rules.redemptionCurvePctByWeek.length > 0) {
    return rules.redemptionCurvePctByWeek;
  }
  return defaultRedemptionCurve(weeks, product.creditsIncluded);
}

/** Expected credits redeemed in a calendar month after purchase (monthOffset 0 = purchase month). */
export function expectedCreditsRedeemedInMonth(
  product: Product,
  assumptions: FinanceAssumptions,
  packSales: number,
  monthOffset = 0
): Decimal {
  if (product.type === "drop_in") {
    return d(Math.max(0, packSales));
  }
  if (product.type === "private") {
    return d(Math.max(0, packSales));
  }
  if (packSales <= 0) return new Decimal(0);

  const econ = analyzeFlexiblePack(product, assumptions);
  const curve = getRedemptionCurvePctByWeek(product, assumptions);
  const weeksPerMonth = WEEKS_PER_MONTH.toNumber();
  const startWeek = Math.floor(monthOffset * weeksPerMonth);
  const endWeek = Math.min(curve.length, Math.ceil((monthOffset + 1) * weeksPerMonth));
  const monthSharePct =
    curve.slice(startWeek, endWeek).reduce((sum, pct) => sum + pct, 0) / 100;

  return d(packSales).times(econ.expectedCreditsRedeemed).times(monthSharePct);
}

export function analyzeFlexiblePack(
  product: Product,
  assumptions: FinanceAssumptions
): FlexiblePackEconomics {
  const rules = resolvePackRules(product);
  const credits = d(product.creditsIncluded);
  const validityWeeks = validityInWeeks(rules);
  const grossPrice = productGrossPrice(product, assumptions);
  const netPackage = productNetPrice(product, assumptions);
  const taxCollected = grossPrice.minus(netPackage);
  const netCashCollected = netPackage;

  const redemptionPct = d(rules.expectedRedemptionRatePct).dividedBy(100);
  const breakagePct = d(rules.expectedBreakageRatePct).dividedBy(100);
  const cancelPct = d(rules.expectedCancellationRatePct).dividedBy(100);
  const peakShare = d(rules.expectedPeakBookingSharePct).dividedBy(100);

  const grossRedemptionFlow = credits.times(redemptionPct);
  const expectedCreditsForfeited = grossRedemptionFlow.times(cancelPct);
  const expectedCreditsRedeemed = grossRedemptionFlow.minus(expectedCreditsForfeited);
  const expectedCreditsExpired = credits.times(breakagePct);
  const expectedCreditsRemaining = Decimal.max(
    0,
    credits.minus(grossRedemptionFlow).minus(expectedCreditsExpired)
  );
  const expectedCreditsUnused = Decimal.max(0, credits.minus(expectedCreditsRedeemed));

  /** Planning model: full net sales at purchase — redemption does not reduce sale value */
  const netSalesFromPack = netPackage;
  const expectedEarnedRevenue = netSalesFromPack;
  const deferredUnearnedRevenue = new Decimal(0);

  const netPerCredit = credits.isZero() ? new Decimal(0) : netPackage.dividedBy(credits);
  const grossPerCredit = credits.isZero() ? new Decimal(0) : grossPrice.dividedBy(credits);

  const variablePerSession =
    rules.variableCostPerAttendedSession != null
      ? d(rules.variableCostPerAttendedSession)
      : variableCostPerAttendedSeat(assumptions);

  const paymentFeePerCredit = paymentFeeOnNet(assumptions, netPerCredit);
  const expectedVariableCost = expectedCreditsRedeemed.times(variablePerSession.plus(paymentFeePerCredit));
  const expectedContribution = netSalesFromPack.minus(expectedVariableCost);
  const contributionMarginPct = netSalesFromPack.isZero()
    ? new Decimal(0)
    : expectedContribution.dividedBy(netSalesFromPack).times(100);

  const weeks = Math.max(1, Math.ceil(validityWeeks.toNumber()));
  const curve =
    rules.redemptionCurvePctByWeek && rules.redemptionCurvePctByWeek.length > 0
      ? rules.redemptionCurvePctByWeek
      : defaultRedemptionCurve(weeks, credits.toNumber());

  const finalQuarterWeeks = Math.max(1, Math.ceil(weeks * 0.25));
  const expiryCliffPct = curve
    .slice(-finalQuarterWeeks)
    .reduce((s, v) => s + v, 0);

  let weightedWeekSum = 0;
  let weightTotal = 0;
  curve.forEach((pct, idx) => {
    weightedWeekSum += (idx + 1) * pct;
    weightTotal += pct;
  });
  const expectedWeeksToFullRedemption =
    weightTotal === 0 ? validityWeeks.dividedBy(2) : d(weightedWeekSum / weightTotal);

  const expectedPeakSessions = expectedCreditsRedeemed.times(peakShare);
  const expectedOffPeakSessions = expectedCreditsRedeemed.minus(expectedPeakSessions);

  const summary = `${product.name}: ${credits.toFixed(0)} credits over ${validityWeeks.toFixed(1)} weeks. Customer pays ${grossPrice.toFixed(0)} (incl. GST); net sales ${netPackage.toFixed(0)}. ~${expectedCreditsRedeemed.toFixed(1)} credits expected to redeem (~${expectedCreditsUnused.toFixed(1)} unused). Lower redemption improves pack economics via lower delivery costs — unused credits are not lost revenue unless refunded.`;

  return {
    productId: product.id,
    name: product.name,
    credits: product.creditsIncluded,
    validityWeeks,
    grossPrice,
    netPackageValue: netPackage,
    taxCollected,
    netCashCollected,
    grossPerCredit,
    netPerCredit,
    expectedCreditsRedeemed,
    expectedCreditsExpired,
    expectedCreditsForfeited,
    expectedCreditsRemaining,
    expectedCreditsUnused,
    expectedRedemptionPct: d(rules.expectedRedemptionRatePct),
    expectedBreakagePct: d(rules.expectedBreakageRatePct),
    expectedEarnedRevenue,
    deferredUnearnedRevenue,
    expectedVariableCost,
    expectedContribution,
    contributionMarginPct,
    expectedReformerSessions: expectedCreditsRedeemed,
    expectedPeakSessions,
    expectedOffPeakSessions,
    expectedWeeksToFullRedemption,
    expectedOutstandingCreditDurationWeeks: validityWeeks,
    expiryCliffRiskPct: d(expiryCliffPct),
    plainEnglishSummary: summary,
    traces: {
      netSales: trace(
        "Net sales from pack",
        "Full net package value at purchase — redemption affects delivery costs, not sale value",
        "INR",
        [
          { label: "Customer pays (incl. GST)", expression: grossPrice.toString(), result: grossPrice },
          { label: "Net sales after GST", expression: netPackage.toString(), result: netPackage },
          { label: "Expected credits redeemed", expression: expectedCreditsRedeemed.toString(), result: expectedCreditsRedeemed },
        ],
        netSalesFromPack
      ),
    },
  };
}

export interface ValidityStressScenario {
  validityWeeks: number;
  label: string;
  economics: FlexiblePackEconomics;
  comparisonNote: string;
}

export function getValidityStressWeeksForPreset(
  product: Product,
  preset: ValidityPreset
): number[] {
  const cfg = VALIDITY_PRESETS[preset];
  const credits = product.creditsIncluded;
  if (credits >= 12) {
    return [cfg.pack16Weeks - 4, cfg.pack16Weeks, cfg.pack16Weeks + 4].filter((w) => w > 0);
  }
  if (credits >= 4) {
    return [cfg.pack8Weeks - 2, cfg.pack8Weeks, cfg.pack8Weeks + 2].filter((w) => w > 0);
  }
  const base = resolvePackRules(product).validityValue;
  const delta = Math.max(1, Math.round(base * 0.25));
  return [base - delta, base, base + delta].filter((w) => w > 0);
}

export function runValidityPresetSensitivity(
  product: Product,
  assumptions: FinanceAssumptions,
  preset: ValidityPreset
): ValidityStressScenario[] {
  return runValidityStressTest(
    product,
    assumptions,
    getValidityStressWeeksForPreset(product, preset)
  );
}

export function runValidityStressTest(
  product: Product,
  assumptions: FinanceAssumptions,
  validityWeeksOptions: number[]
): ValidityStressScenario[] {
  const base = analyzeFlexiblePack(product, assumptions);
  return validityWeeksOptions.map((weeks) => {
    const rules = resolvePackRules(product);
    const modified: Product = {
      ...product,
      packRules: { ...rules, validityValue: weeks, validityUnit: "weeks" },
    };
    const economics = analyzeFlexiblePack(modified, assumptions);
    const longer = weeks > base.validityWeeks.toNumber();
    const note = longer
      ? `Moving ${product.name} from ${base.validityWeeks.toFixed(0)} to ${weeks} weeks gives customers more time, keeping ~${economics.expectedCreditsRemaining.minus(base.expectedCreditsRemaining).toFixed(1)} more credits outstanding longer — delivery costs may rise if redemption spreads over more weeks.`
      : `Tighter ${weeks}-week validity increases expiry cliff risk to ${economics.expiryCliffRiskPct.toFixed(0)}% of redemptions in the final quarter of validity.`;
    return {
      validityWeeks: weeks,
      label: `${weeks} weeks`,
      economics,
      comparisonNote: note,
    };
  });
}

export interface SafePackSalesInput {
  product: Product;
  assumptions: FinanceAssumptions;
  additionalPacksToSell: number;
  currentOutstandingCredits: Decimal;
  eligibleFlexibleCapacitySessions: Decimal;
  eligiblePeakFlexibleCapacitySessions: Decimal;
}

export interface SafePackSalesResult {
  currentOutstandingCredits: Decimal;
  currentExpectedRedemptions: Decimal;
  eligibleCapacityDuringValidity: Decimal;
  currentCapacityHeadroom: Decimal;
  additionalPacksTested: Decimal;
  creditsAdded: Decimal;
  expectedAdditionalRedemptions: Decimal;
  totalExpectedRedemptionsAfterSale: Decimal;
  headroomAfterSale: Decimal;
  capacityCoverageRatio: Decimal;
  status: "comfortable" | "tight" | "overcommitted";
  formulaNotes: string;
  /** @deprecated */
  additionalCreditsCreated: Decimal;
  additionalExpectedRedemptions: Decimal;
  outstandingAfterSale: Decimal;
  peakRedemptionCoverage: Decimal;
  warningLevel: "ok" | "caution" | "pressure";
  plainEnglishSummary: string;
}

export function estimateSafePackSales(input: SafePackSalesInput): SafePackSalesResult {
  const econ = analyzeFlexiblePack(input.product, input.assumptions);
  const rules = resolvePackRules(input.product);
  const packs = d(input.additionalPacksToSell);
  const creditsAdded = d(input.product.creditsIncluded).times(packs);
  const expectedAdditionalRedemptions = econ.expectedCreditsRedeemed.times(packs);

  const outstandingAfter = input.currentOutstandingCredits.plus(creditsAdded);

  const weeksPerMonth = d(52).dividedBy(12);
  const validityWeeks = validityInWeeks(rules);
  /** Monthly eligible flexible spots × (validity window in months) */
  const eligibleCapacityDuringValidity = input.eligibleFlexibleCapacitySessions.times(
    validityWeeks.dividedBy(weeksPerMonth)
  );

  const currentExpectedRedemptions = deriveExpectedFutureRedemptions(input.assumptions);

  const totalExpectedRedemptionsAfterSale = currentExpectedRedemptions.plus(
    expectedAdditionalRedemptions
  );

  const currentCapacityHeadroom = eligibleCapacityDuringValidity.minus(
    currentExpectedRedemptions
  );
  const headroomAfterSale = eligibleCapacityDuringValidity.minus(
    totalExpectedRedemptionsAfterSale
  );

  const capacityCoverageRatio = totalExpectedRedemptionsAfterSale.isZero()
    ? new Decimal(999)
    : eligibleCapacityDuringValidity.dividedBy(totalExpectedRedemptionsAfterSale);

  let status: SafePackSalesResult["status"] = "comfortable";
  if (headroomAfterSale.lt(0)) status = "overcommitted";
  else if (capacityCoverageRatio.lt(1.2)) status = "tight";

  const warningLevel: SafePackSalesResult["warningLevel"] =
    status === "overcommitted" ? "pressure" : status === "tight" ? "caution" : "ok";

  const formulaNotes =
    "Eligible capacity = monthly uncommitted flexible spots × (pack validity weeks ÷ 4.33). " +
    "Expected redemptions = outstanding credits × (expected redeemed ÷ credits sold per pack). " +
    "Headroom = eligible capacity − expected redemptions. Coverage ≥ 1.2× = comfortable; < 1× = overcommitted.";

  const plainEnglishSummary =
    status === "overcommitted"
      ? `Selling ${input.additionalPacksToSell} more pack(s) would leave ~${headroomAfterSale.abs().toFixed(0)} more expected redemptions than eligible capacity in the validity window.`
      : status === "tight"
        ? `Capacity is tight after ${input.additionalPacksToSell} additional pack(s) — coverage ${capacityCoverageRatio.toFixed(2)}× in the validity window.`
        : `Selling ${input.additionalPacksToSell} more pack(s) looks comfortable — ~${headroomAfterSale.toFixed(0)} reformer spots headroom in the validity window.`;

  return {
    currentOutstandingCredits: input.currentOutstandingCredits,
    currentExpectedRedemptions,
    eligibleCapacityDuringValidity,
    currentCapacityHeadroom,
    additionalPacksTested: packs,
    creditsAdded,
    expectedAdditionalRedemptions,
    totalExpectedRedemptionsAfterSale,
    headroomAfterSale,
    capacityCoverageRatio,
    status,
    formulaNotes,
    additionalCreditsCreated: creditsAdded,
    additionalExpectedRedemptions: expectedAdditionalRedemptions,
    outstandingAfterSale: outstandingAfter,
    peakRedemptionCoverage: capacityCoverageRatio,
    warningLevel,
    plainEnglishSummary,
  };
}

export function listFlexiblePacks(assumptions: FinanceAssumptions): Product[] {
  return getActiveProducts(assumptions)
    .filter(
      (p) =>
        (p.type === "credit_pack" || p.type === "drop_in") &&
        p.packRules?.active !== false
    )
    .sort((a, b) => (a.packRules?.displayOrder ?? 0) - (b.packRules?.displayOrder ?? 0));
}

export function analyzeFlexiblePackPortfolio(assumptions: FinanceAssumptions): {
  packs: FlexiblePackEconomics[];
  blendedNetPerCredit: Decimal;
  totalExpectedEarnedRevenue: Decimal;
  totalCashCollected: Decimal;
  totalDeferredRevenue: Decimal;
} {
  const packs = listFlexiblePacks(assumptions).map((p) => analyzeFlexiblePack(p, assumptions));
  const creditMix = calculateFlexibleCreditMix(assumptions);

  let netSales = d(0);
  let cash = d(0);

  for (const row of creditMix.rows) {
    if (row.flexibleCreditMixPct.isZero()) continue;
    const econ = analyzeFlexiblePack(row.product, assumptions);
    const weight = row.flexibleCustomerMixPct.dividedBy(100);
    netSales = netSales.plus(econ.netPackageValue.times(weight));
    cash = cash.plus(econ.grossPrice.times(weight));
  }

  return {
    packs,
    blendedNetPerCredit: creditMix.weightedNominalNetPricePerCredit,
    totalExpectedEarnedRevenue: netSales,
    totalCashCollected: cash,
    totalDeferredRevenue: new Decimal(0),
  };
}
