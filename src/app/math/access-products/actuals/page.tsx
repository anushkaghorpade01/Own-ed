"use client";

import { useMemo } from "react";
import { useApp } from "@/lib/store/app-store";
import { useFinanceModel } from "@/hooks/use-finance-model";
import { SectionHeader, SampleBanner } from "@/components/shared/metric-card";
import { compareActualsVsAssumed, ledgerEventsFromModelledAssumptions, cohortsFromModelledAssumptions } from "@/lib/finance/engine/actuals-engine";
import { Badge } from "@/components/ui/badge";

export default function AccessActualsPage() {
  const { state } = useApp();
  const model = useFinanceModel();

  const comparison = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 90);
    return compareActualsVsAssumed({
      assumptions: state.assumptions,
      ledgerEvents: ledgerEventsFromModelledAssumptions(state.assumptions),
      cohorts: cohortsFromModelledAssumptions(state.assumptions),
      persistedActuals: [],
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
    });
  }, [state.assumptions]);

  return (
    <div>
      <SectionHeader
        title="Actuals"
        description="Assumed vs actual behavioural metrics. Forecast basis stays on assumptions until you choose otherwise."
      />
      <SampleBanner />

      {comparison.insufficientData && (
        <p className="mb-4 rounded-lg border border-[#E8E2D9] bg-[#FAF8F5] p-4 text-sm text-[#6B6560]">
          Not enough actual purchase/redemption data yet — showing assumed model values. Connect
          Google Sheets and record ledger events to populate trailing actuals.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-[#E8E2D9]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E8E2D9] bg-[#FAF8F5] text-left text-xs uppercase text-[#A39E98]">
              <th className="p-3">Metric</th>
              <th className="p-3 text-right">Assumed</th>
              <th className="p-3 text-right">Actual</th>
              <th className="p-3">Forecast basis</th>
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row) => (
              <tr key={`${row.productId}-${row.metricKey}`} className="border-b border-[#E8E2D9]">
                <td className="p-3">{row.label}</td>
                <td className="p-3 text-right tabular-nums">
                  {row.assumed.toFixed(1)}{row.unit}
                </td>
                <td className="p-3 text-right tabular-nums">
                  {row.actual != null ? `${row.actual.toFixed(1)}${row.unit}` : "—"}
                </td>
                <td className="p-3">
                  <Badge variant="outline">{row.forecastBasis}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3 text-sm">
        <Metric label="Credit coverage" value={`${model.accessProducts.creditHealth.overallRedemptionCoverage.toFixed(2)}×`} />
        <Metric label="Outstanding credits" value={model.accessProducts.creditHealth.creditsOutstanding.toFixed(0)} />
        <Metric label="Peak pressure" value={`${model.accessProducts.creditHealth.peakRedemptionCoverage.isZero() ? 100 : (100 / model.accessProducts.creditHealth.peakRedemptionCoverage.toNumber()).toFixed(0)}%`} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E8E2D9] bg-white p-4">
      <p className="text-xs text-[#A39E98]">{label}</p>
      <p className="mt-1 font-medium tabular-nums">{value}</p>
    </div>
  );
}
