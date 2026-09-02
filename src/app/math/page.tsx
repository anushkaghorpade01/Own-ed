"use client";

import { useFinanceModel } from "@/hooks/use-finance-model";
import { MetricCard, SectionHeader, MetricGrid } from "@/components/shared/metric-card";
import { WeightedRevenueCard } from "@/components/finance/weighted-revenue-card";
import { getModelInsights, explainGrossMargin } from "@/lib/finance/business-insights";
import { formatINR, formatPercent } from "@/lib/format/currency";

export default function MathOverviewPage() {
  const model = useFinanceModel();
  const insights = getModelInsights(model);
  const grossMarginInsight = explainGrossMargin(model);
  const breakEven = model.breakEven.contributionBreakEven;

  return (
    <div>
      <SectionHeader
        title="Math Overview"
        description="Central financial model — all pages use the same calculation engine."
      />

      <MetricGrid columns={3} className="page-section">
        <MetricCard
          label="Break-even occupancy"
          value={formatPercent(breakEven.breakEvenOccupancyPct)}
          subtitle={`${breakEven.requiredOccupiedSeats.toFixed(0)} of ${model.capacity.monthlyAvailableSeats.toFixed(0)} monthly reformer spots`}
          explainerSections={[{ title: "What it means", content: insights[0].explanation }]}
          trace={breakEven.trace}
        />
        <MetricCard
          label="Occupied seats / month"
          value={model.capacity.occupiedSeatsMonthly.toFixed(0)}
          subtitle={`${model.assumptions.projectedBookedOccupancyPct}% expected booked occupancy`}
          trace={model.capacity.traces.occupiedSeats}
        />
        <MetricCard
          label="Planning net sales"
          value={formatINR(model.revenue.netRevenue)}
          subtitle="Ex-GST — see Dictionary for cash vs sales timing"
          trace={model.revenue.traces.groupClass}
        />
        <MetricCard
          label="Monthly available seats"
          value={model.capacity.monthlyAvailableSeats.toFixed(0)}
          subtitle={`${model.unusedCapacity.unusedCapacity.toFixed(0)} unused at current occupancy`}
          trace={model.capacity.traces.monthlySeats}
        />
        <MetricCard
          label="Gross profit"
          value={formatINR(model.pl.grossProfit)}
          explainerSections={[{ title: "What it means", content: grossMarginInsight.explanation }]}
          trace={model.pl.traces.grossProfit}
        />
        <MetricCard
          label="EBITDA"
          value={formatINR(model.pl.ebitda)}
          explainerSections={[{ title: "What it means", content: insights[2].explanation }]}
          trace={model.pl.traces.ebitda}
        />
      </MetricGrid>

      <WeightedRevenueCard />
    </div>
  );
}
