"use client";

import { useFinanceModel } from "@/hooks/use-finance-model";
import { SectionHeader, SampleBanner, MetricCard, BusinessInsightCard } from "@/components/shared/metric-card";
import {
  explainBreakEvenOccupancy,
  explainContributionMargin,
} from "@/lib/finance/business-insights";
import { formatINR, formatPercent } from "@/lib/format/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function BreakEvenPage() {
  const model = useFinanceModel();
  const be = model.breakEven;
  const contributionInsight = explainBreakEvenOccupancy(model);
  const marginInsight = explainContributionMargin(model);

  return (
    <div>
      <SectionHeader
        title="Break-even Analysis"
        description="How full does the studio need to be before it stops losing money?"
      />
      <SampleBanner />

      <div className="mb-8 grid gap-4">
        <BusinessInsightCard {...contributionInsight} />
        <BusinessInsightCard {...marginInsight} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MetricCard
          label="Contribution break-even occupancy"
          value={formatPercent(be.contributionBreakEven.breakEvenOccupancyPct)}
          subtitle={`${be.contributionBreakEven.requiredOccupiedSeats.toFixed(0)} occupied seats/month required`}
          businessInsight={contributionInsight.explanation}
          trace={be.contributionBreakEven.trace}
        />
        <MetricCard
          label="EBITDA break-even occupancy"
          value={formatPercent(be.ebitdaBreakEvenOccupancyPct)}
          businessInsight={`To cover ALL operating expenses (not just fixed costs), you need ${be.ebitdaBreakEvenOccupancyPct.toFixed(0)}% occupancy. This is higher than contribution break-even because it includes variable costs like laundry and marketing.`}
        />
        <MetricCard
          label="Operating cash break-even"
          value={be.cashBreakEvenMonth ? `Month ${be.cashBreakEvenMonth}` : "Not reached in 36 months"}
          businessInsight="The first month when cash coming in from customers exceeds cash going out to run the studio — you stop needing to inject cash each month."
        />
        <MetricCard
          label="Current EBITDA at planned occupancy"
          value={formatINR(model.pl.ebitda)}
          subtitle={`At ${model.assumptions.projectedBookedOccupancyPct}% occupancy`}
          businessInsight={
            model.pl.ebitda.isPositive()
              ? `You're ${formatPercent(be.contributionBreakEven.breakEvenOccupancyPct.minus(model.assumptions.projectedBookedOccupancyPct))} above break-even.`
              : `You're losing money — need ${be.contributionBreakEven.breakEvenOccupancyPct.minus(model.assumptions.projectedBookedOccupancyPct).toFixed(0)} more percentage points of occupancy.`
          }
        />
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Four different break-even concepts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-[#6B6560]">
          <div>
            <p className="font-medium text-[#2C2825]">1. Contribution break-even ({formatPercent(be.contributionBreakEven.breakEvenOccupancyPct)})</p>
            <p>How full the studio must be for delivered class contribution to cover fixed costs. Seats below this threshold do not contribute to fixed cost coverage — this is not the same as unused capacity being a revenue loss.</p>
          </div>
          <div>
            <p className="font-medium text-[#2C2825]">2. EBITDA break-even ({formatPercent(be.ebitdaBreakEvenOccupancyPct)})</p>
            <p>How full the studio must be to cover ALL operating expenses including variable costs. Higher than contribution break-even.</p>
          </div>
          <div>
            <p className="font-medium text-[#2C2825]">3. Cash break-even (month {be.cashBreakEvenMonth ?? "—"})</p>
            <p>When monthly cash in exceeds monthly cash out. Accounts for ramp-up — early months have lower occupancy.</p>
          </div>
          <div>
            <p className="font-medium text-[#2C2825]">4. Investment payback</p>
            <p>See Payback page — when cumulative operating cash recovers your initial setup investment.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
