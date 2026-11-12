"use client";

import { useFinanceModel } from "@/hooks/use-finance-model";
import { MetricCard, SectionHeader, MetricGrid } from "@/components/shared/metric-card";
import { WeightedRevenueCard } from "@/components/finance/weighted-revenue-card";
import { getModelInsights, explainGrossMargin } from "@/lib/finance/business-insights";
import { formatINR, formatPercent } from "@/lib/format/currency";
import Link from "next/link";
import { forecastOwnPlan, OWN_SERVICES } from "@/lib/finance/engine/own-operating-plan";

export default function MathOverviewPage() {
  const model = useFinanceModel();
  const insights = getModelInsights(model);
  const grossMarginInsight = explainGrossMargin(model);
  const breakEven = model.breakEven.contributionBreakEven;

  if (model.assumptions.ownOperatingPlan?.enabled) {
    const plan = model.assumptions.ownOperatingPlan;
    const january = forecastOwnPlan(plan, model.assumptions.weeksClosedPerYear)[0];
    return <div className="space-y-5">
      <SectionHeader title="Math Overview" description="OWN monthly sales, service demand, capacity and profitability. All amounts are planning estimates." />
      <MetricGrid columns={3} className="page-section">
        <MetricCard label="Monthly sales" value={formatINR(model.pl.netRevenue)} subtitle="Core packages and other revenue, excluding GST" />
        <MetricCard label="EBITDA" value={formatINR(model.pl.ebitda)} subtitle="After private payouts, salaries and other operating expenses" />
        <MetricCard label="Net profit" value={formatINR(model.pl.netProfit)} subtitle="Planning profit after depreciation, interest and tax" />
        <MetricCard label="Forecast packages sold" value={january.packageSales.toFixed(0)} subtitle="January, based on current seasonal demand" />
        <MetricCard label="Target revenue gap" value={formatINR(january.revenueGap)} subtitle="January target less forecast sales" />
        <MetricCard label="Capacity utilisation" value={formatPercent(model.summary.utilisationPct)} subtitle="Expected service visits / scheduled service slots" />
      </MetricGrid>
      <div className="rounded-xl border border-[#E8E2D9] bg-white p-4 space-y-2">
        <h2 className="font-semibold">Service demand by type · January</h2>
        <div className="grid gap-3 sm:grid-cols-2">{OWN_SERVICES.map(service => <div key={service} className="rounded-lg bg-[#FAF8F5] p-3 text-sm"><div className="font-medium">{service.replaceAll("_", " ")}</div><div>{january.demand[service].toFixed(0)} visits expected / {january.capacity[service].toFixed(0)} available</div></div>)}</div>
        <p className={january.capacityFeasible?"text-sm text-emerald-700":"text-sm text-red-700"}>{january.capacityFeasible?"Schedule is feasible at expected demand.":"Expected demand exceeds the timetable or there are trainer conflicts."}</p>
        <Link className="text-sm underline" href="/math/own-plan">Edit OWN products, timetable and monthly targets</Link>
      </div>
    </div>;
  }

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
