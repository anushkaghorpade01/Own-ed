import Decimal from "decimal.js";
import { d } from "@/lib/finance/decimal";
import type { FinanceModelOutput } from "@/lib/finance/run-model";

export interface HealthCheckResult {
  id: string;
  label: string;
  passed: boolean;
  expected?: string;
  actual?: string;
  note?: string;
}

export function runOwnedHealthChecks(model: FinanceModelOutput): HealthCheckResult[] {
  const results: HealthCheckResult[] = [];
  const wr = model.revenue.weightedRevenue;

  results.push({
    id: "service-mix-total",
    label: "Service demand mix totals 100%",
    passed: wr.mixValid && wr.mixTotal.minus(100).abs().lte(0.01),
    expected: "100%",
    actual: `${wr.mixTotal.toFixed(1)}%`,
  });

  const sumWeighted = wr.serviceBookingBreakdown.reduce(
    (s, r) => s.plus(r.weightedNetSalesImpact),
    d(0)
  );
  results.push({
    id: "blended-sales-sum",
    label: "Blended net sales equals sum of weighted rows",
    passed: sumWeighted.minus(wr.blendedNetSalesPerOccupiedSpot).abs().lte(0.01),
    expected: formatDec(wr.blendedNetSalesPerOccupiedSpot),
    actual: formatDec(sumWeighted),
  });

  results.push({
    id: "occupancy-cap",
    label: "Occupancy is at most 100%",
    passed: model.assumptions.projectedBookedOccupancyPct <= 100,
    expected: "≤ 100%",
    actual: `${model.assumptions.projectedBookedOccupancyPct}%`,
  });

  const health = model.cashFlow.cashHealth;
  const fundingReconciles = health.minimumTotalFundingRequired
    .minus(health.totalPlannedFunding.plus(health.fundingGap))
    .abs()
    .lte(0.01);
  results.push({
    id: "funding-reconciliation",
    label: "Minimum funding = planned funding + funding gap",
    passed: fundingReconciles,
    expected: formatDec(health.totalPlannedFunding.plus(health.fundingGap)),
    actual: formatDec(health.minimumTotalFundingRequired),
    note: fundingReconciles
      ? undefined
      : "These values do not appear to reconcile. This should be checked.",
  });

  if (model.yearlyPL.years.length >= 1) {
    const year1Monthly = model.monthlyProjection
      .filter((m) => m.month >= 1 && m.month <= 12)
      .reduce((s, m) => s.plus(m.pl.netProfit), d(0));
    const year1Annual = model.yearlyPL.years[0]?.netProfit ?? d(0);
    results.push({
      id: "annual-pl-sum",
      label: "Year 1 P&L equals sum of months 1–12",
      passed: year1Monthly.minus(year1Annual).abs().lte(1),
      expected: formatDec(year1Annual),
      actual: formatDec(year1Monthly),
    });
  }

  return results;
}

function formatDec(v: Decimal): string {
  return v.toFixed(0);
}

export function renderHealthCheckAnswer(checks: HealthCheckResult[]): {
  sections: Array<{ title?: string; body: string }>;
} {
  const failures = checks.filter((c) => !c.passed);
  if (failures.length === 0) {
    return {
      sections: [
        {
          title: "Model health",
          body: "The calculation passes the checks OWNED currently runs.",
        },
      ],
    };
  }

  const lines = failures.map(
    (f) =>
      `${f.label}\nExpected: ${f.expected ?? "—"}\nActual: ${f.actual ?? "—"}${f.note ? `\n${f.note}` : ""}`
  );

  return {
    sections: [
      {
        title: "This looks inconsistent",
        body: lines.join("\n\n"),
      },
    ],
  };
}
