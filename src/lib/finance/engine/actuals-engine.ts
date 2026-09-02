/**
 * Actuals vs Assumed — compares modelled assumptions to persisted ledger/cohort data.
 */
import type { FinanceAssumptions, Product } from "../schemas";
import type { ActualRecord, CreditLedgerEvent, PackCohortRecord } from "@/lib/data/types";
import { analyzeFlexiblePack, listFlexiblePacks, resolvePackRules } from "./flexible-packs";
import { buildCreditLedgerFromAssumptions } from "./credit-ledger";

export interface ActualMetricRow {
  metricKey: string;
  label: string;
  assumed: number;
  actual?: number;
  forecastBasis: "assumed" | "actual" | "custom";
  unit: string;
  productId?: string;
  productName?: string;
  hasEnoughData: boolean;
}

export interface ActualsComparison {
  rows: ActualMetricRow[];
  periodStart: string;
  periodEnd: string;
  insufficientData: boolean;
}

const MIN_EVENTS_FOR_ACTUAL = 3;

function sumLedger(
  events: CreditLedgerEvent[],
  type: CreditLedgerEvent["eventType"]
): number {
  return events
    .filter((e) => e.eventType === type)
    .reduce((s, e) => s + Math.abs(e.creditsDelta), 0);
}

export function buildAssumedFlexibleMetrics(
  assumptions: FinanceAssumptions
): ActualMetricRow[] {
  const rows: ActualMetricRow[] = [];
  for (const pack of listFlexiblePacks(assumptions)) {
    const econ = analyzeFlexiblePack(pack, assumptions);
    rows.push(
      {
        metricKey: "redemption_rate_pct",
        label: "Redemption rate",
        assumed: econ.expectedRedemptionPct.toNumber(),
        forecastBasis: "assumed",
        unit: "%",
        productId: pack.id,
        productName: pack.name,
        hasEnoughData: true,
      },
      {
        metricKey: "breakage_rate_pct",
        label: "Breakage rate",
        assumed: econ.expectedBreakagePct.toNumber(),
        forecastBasis: "assumed",
        unit: "%",
        productId: pack.id,
        productName: pack.name,
        hasEnoughData: true,
      },
      {
        metricKey: "peak_booking_share_pct",
        label: "Peak booking share",
        assumed: resolvePackRules(pack).expectedPeakBookingSharePct,
        forecastBasis: "assumed",
        unit: "%",
        productId: pack.id,
        productName: pack.name,
        hasEnoughData: true,
      }
    );
  }
  return rows;
}

export function compareActualsVsAssumed(input: {
  assumptions: FinanceAssumptions;
  ledgerEvents: CreditLedgerEvent[];
  cohorts: PackCohortRecord[];
  persistedActuals: ActualRecord[];
  periodStart: string;
  periodEnd: string;
}): ActualsComparison {
  const assumedRows = buildAssumedFlexibleMetrics(input.assumptions);
  const productEvents = input.ledgerEvents.filter(
    (e) => e.eventAt >= input.periodStart && e.eventAt <= input.periodEnd
  );

  if (productEvents.length < MIN_EVENTS_FOR_ACTUAL) {
    return {
      rows: assumedRows.map((r) => ({
        ...r,
        actual: undefined,
        hasEnoughData: false,
      })),
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      insufficientData: true,
    };
  }

  const rows: ActualMetricRow[] = [];

  for (const pack of listFlexiblePacks(input.assumptions)) {
    const packEvents = productEvents.filter((e) => e.productId === pack.id);
    const purchased = sumLedger(packEvents, "PACK_PURCHASED");
    const redeemed = sumLedger(packEvents, "CREDIT_REDEEMED");
    const expired = sumLedger(packEvents, "CREDIT_EXPIRED");

    const assumedRedemption = analyzeFlexiblePack(pack, input.assumptions)
      .expectedRedemptionPct.toNumber();
    const actualRedemption = purchased > 0 ? (redeemed / purchased) * 100 : undefined;
    const actualBreakage = purchased > 0 ? (expired / purchased) * 100 : undefined;

    const persisted = input.persistedActuals.find(
      (a) => a.productId === pack.id && a.metricKey === "redemption_rate_pct"
    );

    rows.push({
      metricKey: "redemption_rate_pct",
      label: `${pack.name} redemption`,
      assumed: assumedRedemption,
      actual: actualRedemption,
      forecastBasis: persisted?.forecastBasis ?? "assumed",
      unit: "%",
      productId: pack.id,
      productName: pack.name,
      hasEnoughData: packEvents.length >= MIN_EVENTS_FOR_ACTUAL,
    });

    rows.push({
      metricKey: "breakage_rate_pct",
      label: `${pack.name} breakage`,
      assumed: analyzeFlexiblePack(pack, input.assumptions).expectedBreakagePct.toNumber(),
      actual: actualBreakage,
      forecastBasis: "assumed",
      unit: "%",
      productId: pack.id,
      productName: pack.name,
      hasEnoughData: packEvents.length >= MIN_EVENTS_FOR_ACTUAL,
    });
  }

  const ledger = buildCreditLedgerFromAssumptions(input.assumptions);
  rows.push({
    metricKey: "credits_outstanding",
    label: "Credits outstanding",
    assumed: ledger.totals.creditsRemaining.toNumber(),
    actual: input.cohorts.reduce((s, c) => s + c.creditsRemaining, 0),
    forecastBasis: "assumed",
    unit: "credits",
    hasEnoughData: input.cohorts.length > 0,
  });

  return {
    rows,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    insufficientData: false,
  };
}

export function ledgerEventsFromModelledAssumptions(
  assumptions: FinanceAssumptions
): CreditLedgerEvent[] {
  const now = new Date().toISOString();
  const events: CreditLedgerEvent[] = [];
  for (const pack of listFlexiblePacks(assumptions)) {
    const rules = pack.packRules;
    const volume = rules?.expectedSalesVolumePerMonth ?? 0;
    if (volume <= 0) continue;
    const econ = analyzeFlexiblePack(pack, assumptions);
    events.push({
      id: `evt-${pack.id}-purchase`,
      eventType: "PACK_PURCHASED",
      productId: pack.id,
      productVersionId: pack.versionId ?? "v1",
      creditsDelta: pack.creditsIncluded * volume,
      amountInr: pack.price * volume,
      eventAt: now,
      createdAt: now,
    });
    events.push({
      id: `evt-${pack.id}-redeemed`,
      eventType: "CREDIT_REDEEMED",
      productId: pack.id,
      productVersionId: pack.versionId ?? "v1",
      creditsDelta: -econ.expectedCreditsRedeemed.toNumber() * volume,
      amountInr: 0,
      eventAt: now,
      createdAt: now,
    });
    events.push({
      id: `evt-${pack.id}-expired`,
      eventType: "CREDIT_EXPIRED",
      productId: pack.id,
      productVersionId: pack.versionId ?? "v1",
      creditsDelta: -econ.expectedCreditsExpired.toNumber() * volume,
      amountInr: 0,
      eventAt: now,
      createdAt: now,
    });
  }
  return events;
}

export function cohortsFromModelledAssumptions(
  assumptions: FinanceAssumptions
): PackCohortRecord[] {
  const now = new Date().toISOString();
  const period = now.slice(0, 7);
  const ledger = buildCreditLedgerFromAssumptions(assumptions);
  return ledger.cohorts.map((c) => ({
    id: `cohort-${c.productId}`,
    productId: c.productId,
    productVersionId:
      assumptions.products.find((p) => p.id === c.productId)?.versionId ?? "v1",
    purchasePeriod: period,
    creditsSold: c.creditsPurchased.toNumber(),
    creditsRedeemed: c.creditsRedeemed.toNumber(),
    creditsExpired: c.creditsExpired.toNumber(),
    creditsRemaining: c.creditsRemaining.toNumber(),
    cashCollected: 0,
    earnedRevenue: 0,
    deferredRevenue: 0,
    createdAt: now,
    updatedAt: now,
  }));
}
