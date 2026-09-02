"use client";

import Link from "next/link";
import { useFinanceModel } from "@/hooks/use-finance-model";
import { SectionHeader, SampleBanner, MetricCard, MetricGrid, PageSection, BusinessInsightCard } from "@/components/shared/metric-card";
import { explainPayback } from "@/lib/finance/business-insights";
import { OPERATING_CASH_INFLOW_BASIS } from "@/lib/finance/cash-basis";
import { formatINR, formatPercent } from "@/lib/format/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InvestmentRecoveryForecastCard } from "@/components/finance/investment-recovery-forecast-card";

export default function PaybackPage() {
  const model = useFinanceModel();
  const pb = model.payback;
  const launch = model.cashFlow.launch;
  const capex = model.capex;
  const paybackInsight = explainPayback(model);

  return (
    <div>
      <SectionHeader
        title="Investment recovery"
        description="When cumulative operating cash recovers your launch investment hurdle — separate from bank cash and P&L profit."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href="/math/assumptions">Edit setup investment</Link>
          </Button>
        }
      />
      <SampleBanner />

      <div className="mb-6 rounded-lg border border-[#E8E2D9] bg-[#FAF8F5] px-4 py-3 text-sm text-[#6B6560]">
        {OPERATING_CASH_INFLOW_BASIS.paybackCaveat}
      </div>

      <PageSection spacing="major">
        <BusinessInsightCard {...paybackInsight} />
      </PageSection>

      <MetricGrid>
        <MetricCard
          label="Payback period"
          value={
            pb.paybackNotReached
              ? "Not reached (36mo)"
              : pb.paybackMonthEstimate && pb.paybackMonthEstimate !== pb.paybackMonth
                ? `~Month ${pb.paybackMonthEstimate}`
                : `Month ${pb.paybackMonth}`
          }
          subtitle="When recovery position crosses ₹0"
          trace={pb.trace}
        />
        <MetricCard
          label="Investment to recover"
          value={formatINR(pb.initialInvestment)}
          subtitle={
            launch.includeRecoverableDepositInPayback
              ? "Capex + WC + deposit"
              : "Capex + WC (deposit excluded)"
          }
        />
        <MetricCard
          label="Non-recoverable capex"
          value={formatINR(pb.nonRecoverableInvestment)}
        />
        <MetricCard
          label="Working capital"
          value={formatINR(pb.workingCapital)}
          subtitle="Included in hurdle; retained in bank"
        />
      </MetricGrid>

      <MetricGrid columns={3} className="page-section">
        <MetricCard
          label="Recoverable deposits"
          value={formatINR(pb.recoverableDeposits)}
          subtitle={
            model.assumptions.includeRecoverableDepositInPayback
              ? "Included in hurdle"
              : "Excluded from hurdle — paid at launch"
          }
        />
        <MetricCard label="ROI @ 12 months" value={formatPercent(pb.roi12Months)} subtitle="Investment remaining ÷ base" />
        <MetricCard label="ROI @ 36 months" value={formatPercent(pb.roi36Months)} />
      </MetricGrid>

      <InvestmentRecoveryForecastCard
        className="page-section-major"
        chartVariant="area"
        description={`Month 0 = −${formatINR(launch.paybackInvestmentBase)} (full investment hurdle). Each month adds operating cash generated. Crosses zero when payback is reached${
          pb.paybackMonth ? ` — around month ${pb.paybackMonth}` : " — not within 36 months"
        }. Founder equity and loans are excluded — they fund the bank, not reduce what you need to recover.`}
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Initial investment to recover — breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between border-b border-[#F0EBE3] py-1.5">
              <span className="text-[#6B6560]">Non-recoverable capex</span>
              <span>{formatINR(launch.nonRecoverableCapex)}</span>
            </div>
            <div className="flex justify-between border-b border-[#F0EBE3] py-1.5">
              <span className="text-[#6B6560]">Working capital (cash buffer)</span>
              <span>{formatINR(launch.workingCapital)}</span>
            </div>
            <div className="flex justify-between border-b border-[#F0EBE3] py-1.5">
              <span className="text-[#6B6560]">
                Security deposit {launch.includeRecoverableDepositInPayback ? "(in hurdle)" : "(excluded)"}
              </span>
              <span>{formatINR(launch.recoverableDeposits)}</span>
            </div>
            <div className="flex justify-between border-b border-[#F0EBE3] py-1.5 font-medium">
              <span>Payback investment base</span>
              <span>{formatINR(launch.paybackInvestmentBase)}</span>
            </div>
          </div>
          <p className="mb-3 text-xs text-[#A39E98]">
            Cash required at launch (capex + deposit + WC buffer):{" "}
            {formatINR(launch.totalCashRequiredAtLaunch)} · Funding injected:{" "}
            {formatINR(launch.totalFunding)}
            {launch.launchFundingGap.gt(0) &&
              ` · Gap ${formatINR(launch.launchFundingGap)}`}
          </p>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {capex.breakdown
              .filter((item) => item.amount.gt(0))
              .map((item) => (
                <div key={item.name} className="flex justify-between border-b border-[#F0EBE3] py-1.5">
                  <span className="text-[#6B6560]">
                    {item.name}
                    {item.recoverable ? " (recoverable)" : ""}
                  </span>
                  <span className="text-[#2C2825]">{formatINR(item.amount)}</span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
