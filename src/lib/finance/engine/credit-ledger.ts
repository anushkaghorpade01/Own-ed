/**
 * Credit ledger — reconciles purchased, redeemed, expired, and remaining credits.
 */
import Decimal from "decimal.js";
import { d } from "../decimal";
import type { FinanceAssumptions, Product } from "../schemas";
import {
  analyzeFlexiblePack,
  listFlexiblePacks,
  resolvePackRules,
} from "./flexible-packs";

export interface CreditLedgerCohort {
  productId: string;
  productName: string;
  creditsPurchased: Decimal;
  creditsActivated: Decimal;
  creditsRedeemed: Decimal;
  creditsCancelledReturned: Decimal;
  creditsForfeitedLateCancel: Decimal;
  creditsForfeitedNoShow: Decimal;
  creditsExpired: Decimal;
  creditsRemaining: Decimal;
  reconciles: boolean;
}

export interface CreditLedgerResult {
  cohorts: CreditLedgerCohort[];
  totals: CreditLedgerCohort;
  plainEnglishSummary: string;
}

function emptyCohort(): CreditLedgerCohort {
  return {
    productId: "total",
    productName: "Total",
    creditsPurchased: new Decimal(0),
    creditsActivated: new Decimal(0),
    creditsRedeemed: new Decimal(0),
    creditsCancelledReturned: new Decimal(0),
    creditsForfeitedLateCancel: new Decimal(0),
    creditsForfeitedNoShow: new Decimal(0),
    creditsExpired: new Decimal(0),
    creditsRemaining: new Decimal(0),
    reconciles: true,
  };
}

function addCohort(a: CreditLedgerCohort, b: CreditLedgerCohort): CreditLedgerCohort {
  return {
    productId: "total",
    productName: "Total",
    creditsPurchased: a.creditsPurchased.plus(b.creditsPurchased),
    creditsActivated: a.creditsActivated.plus(b.creditsActivated),
    creditsRedeemed: a.creditsRedeemed.plus(b.creditsRedeemed),
    creditsCancelledReturned: a.creditsCancelledReturned.plus(b.creditsCancelledReturned),
    creditsForfeitedLateCancel: a.creditsForfeitedLateCancel.plus(b.creditsForfeitedLateCancel),
    creditsForfeitedNoShow: a.creditsForfeitedNoShow.plus(b.creditsForfeitedNoShow),
    creditsExpired: a.creditsExpired.plus(b.creditsExpired),
    creditsRemaining: a.creditsRemaining.plus(b.creditsRemaining),
    reconciles: a.reconciles && b.reconciles,
  };
}

export function buildCreditLedgerFromAssumptions(
  assumptions: FinanceAssumptions,
  /** Optional: packs sold per product per month for modelling */
  salesVolumeByProductId?: Record<string, number>
): CreditLedgerResult {
  const cohorts: CreditLedgerCohort[] = [];

  for (const product of listFlexiblePacks(assumptions)) {
    const rules = resolvePackRules(product);
    const volume = salesVolumeByProductId?.[product.id] ?? rules.expectedSalesVolumePerMonth;
    const soldPacks = d(Math.max(0, volume));
    const creditsPurchased = d(product.creditsIncluded).times(soldPacks);
    const econ = analyzeFlexiblePack(product, assumptions);

    const creditsRedeemed = econ.expectedCreditsRedeemed.times(soldPacks);
    const creditsExpired = econ.expectedCreditsExpired.times(soldPacks);
    const creditsForfeitedLateCancel = econ.expectedCreditsForfeited.times(soldPacks);
    const creditsForfeitedNoShow = creditsRedeemed.times(
      d(rules.expectedNoShowRatePct).dividedBy(100)
    );
    const creditsRemaining = Decimal.max(
      0,
      creditsPurchased
        .minus(creditsRedeemed)
        .minus(creditsExpired)
        .minus(creditsForfeitedLateCancel)
    );

    const lhs = creditsPurchased;
    const rhs = creditsRedeemed
      .plus(creditsExpired)
      .plus(creditsForfeitedLateCancel)
      .plus(creditsRemaining);

    cohorts.push({
      productId: product.id,
      productName: product.name,
      creditsPurchased,
      creditsActivated: creditsPurchased,
      creditsRedeemed,
      creditsCancelledReturned: new Decimal(0),
      creditsForfeitedLateCancel,
      creditsForfeitedNoShow,
      creditsExpired,
      creditsRemaining,
      reconciles: lhs.minus(rhs).abs().lt(0.01),
    });
  }

  const manualOutstanding = d(assumptions.creditsSoldOutstanding);
  if (manualOutstanding.gt(0) && cohorts.length === 0) {
    const redeemed = d(assumptions.creditsExpectedRedemptionBeforeExpiry);
    const expired = d(assumptions.creditsExpectedToExpireUnused);
    const remaining = Decimal.max(0, manualOutstanding.minus(redeemed).minus(expired));
    cohorts.push({
      productId: "manual",
      productName: "Manual outstanding (legacy input)",
      creditsPurchased: manualOutstanding,
      creditsActivated: manualOutstanding,
      creditsRedeemed: redeemed,
      creditsCancelledReturned: new Decimal(0),
      creditsForfeitedLateCancel: new Decimal(0),
      creditsForfeitedNoShow: new Decimal(0),
      creditsExpired: expired,
      creditsRemaining: remaining,
      reconciles: manualOutstanding.minus(redeemed).minus(expired).minus(remaining).abs().lt(0.01),
    });
  }

  const totals = cohorts.reduce((acc, c) => addCohort(acc, c), emptyCohort());

  return {
    cohorts,
    totals,
    plainEnglishSummary: `${totals.creditsRemaining.toFixed(0)} credits remain outstanding across ${cohorts.length} pack cohort(s). These represent future classes OWN may still need to provide.`,
  };
}

export function deriveOutstandingCredits(assumptions: FinanceAssumptions): Decimal {
  const ledger = buildCreditLedgerFromAssumptions(assumptions);
  if (ledger.totals.creditsRemaining.gt(0)) return ledger.totals.creditsRemaining;
  return d(assumptions.creditsSoldOutstanding);
}

export function deriveExpectedFutureRedemptions(assumptions: FinanceAssumptions): Decimal {
  const ledger = buildCreditLedgerFromAssumptions(assumptions);
  if (ledger.totals.creditsRedeemed.gt(0)) {
    return ledger.totals.creditsRemaining.plus(
      ledger.totals.creditsRedeemed.times(0.3)
    );
  }
  return d(assumptions.creditsExpectedRedemptionBeforeExpiry);
}
