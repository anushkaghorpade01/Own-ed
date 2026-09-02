"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useFinanceModel } from "@/hooks/use-finance-model";
import { SectionHeader, SampleBanner, MetricCard } from "@/components/shared/metric-card";
import { formatINR } from "@/lib/format/currency";
import { OPERATING_CASH_INFLOW_BASIS } from "@/lib/finance/cash-basis";
import {
  buildBankCashSeries,
  buildInvestmentRecoverySeries,
} from "@/lib/finance/engine/investment-recovery";
import { formatRecoveryPositionInr } from "@/components/finance/cash-flow-chart-tooltips";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CashFlowCalculationExplainer } from "@/components/finance/cash-flow-explainer";
import {
  BankCashTooltip,
  InvestmentRecoveryTooltip,
} from "@/components/finance/cash-flow-chart-tooltips";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export default function CashFlowPage() {
  const model = useFinanceModel();
  const cf = model.cashFlow;
  const pb = model.payback;
  const launch = cf.launch;
  const health = cf.cashHealth;
  const month1 = cf.monthly[0];
  const month36 = cf.monthly.find((m) => m.month === 36) ?? cf.monthly[cf.monthly.length - 1];
  const month36Position = month36?.recoveryPosition.toNumber() ?? 0;
  const month36Display = formatRecoveryPositionInr(month36Position);
  const month1Display = month1
    ? formatRecoveryPositionInr(month1.recoveryPosition.toNumber())
    : null;

  const investmentChartData = useMemo(() => {
    const series = buildInvestmentRecoverySeries(cf.monthly, launch.paybackInvestmentBase);
    return series.map((row) => ({
      month: row.month,
      recoveryPosition: row.recoveryPosition.toNumber(),
      monthOperatingCash: row.monthOperatingCash.toNumber(),
      cumulativeOperatingCashGenerated: row.cumulativeOperatingCashGenerated.toNumber(),
      initialInvestment: launch.paybackInvestmentBase.toNumber(),
    }));
  }, [cf.monthly, launch.paybackInvestmentBase]);

  const bankChartData = useMemo(() => {
    return buildBankCashSeries(cf.monthly, launch.openingBankCashAfterLaunch).map((row, i) => {
      const monthRow = i === 0 ? null : cf.monthly[i - 1];
      return {
        month: row.month,
        bankCashBalance: row.bankCashBalance.toNumber(),
        openingBankCashAfterLaunch: launch.openingBankCashAfterLaunch.toNumber(),
        cashInflows: monthRow?.cashInflows.toNumber() ?? 0,
        cashOutflows: monthRow?.cashOutflows.toNumber() ?? 0,
        monthOperatingCash: monthRow?.netOperatingCashFlow.toNumber() ?? 0,
      };
    });
  }, [cf.monthly, launch.openingBankCashAfterLaunch]);

  return (
    <div>
      <SectionHeader
        title="Cash Flow"
        description="Investment recovery (payback) and bank cash (liquidity) are separate models. Funding affects bank cash only — not operating performance or investment recovery."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href="/math/payback">Investment recovery detail</Link>
          </Button>
        }
      />
      <SampleBanner />

      <div className="mb-6 rounded-lg border border-[#E8E2D9] bg-[#FAF8F5] px-4 py-3 text-sm leading-relaxed text-[#6B6560]">
        <p className="font-medium text-[#2C2825]">{OPERATING_CASH_INFLOW_BASIS.shortLabel}</p>
        <p className="mt-1">{OPERATING_CASH_INFLOW_BASIS.explainer}</p>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Initial investment to recover"
          value={formatINR(launch.paybackInvestmentBase)}
          subtitle={
            launch.includeRecoverableDepositInPayback
              ? "Capex + WC + deposit"
              : "Capex + WC (deposit excluded from hurdle)"
          }
        />
        <MetricCard
          label="Monthly cash generated"
          value={month1 ? formatINR(month1.netOperatingCashFlow) : "—"}
          subtitle="Month 1 operating cash"
        />
        <MetricCard
          label="Estimated payback"
          value={
            pb.paybackNotReached
              ? "Not reached (36mo)"
              : pb.paybackMonthEstimate && pb.paybackMonthEstimate !== pb.paybackMonth
                ? `~Month ${pb.paybackMonthEstimate}`
                : `Month ${pb.paybackMonth}`
          }
          subtitle={
            pb.paybackMonth ? `Investment recovered — month ${pb.paybackMonth}` : undefined
          }
        />
        <MetricCard
          label={month36Display.label}
          value={formatINR(month36Display.amount)}
          subtitle={`Month 36 · cumulative generated ${formatINR(health.month36CumulativeOperatingCash)}`}
        />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Investment recovery — 36 month forecast</CardTitle>
          <p className="text-xs text-[#6B6560]">
            How long cumulative operating cash takes to recover your initial investment. Month 0 =
            full hurdle. ₹0 line = initial investment fully recovered. Above zero = net cash above
            investment. Excludes founder equity and loan proceeds.
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={investmentChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E2D9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#A39E98" }} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#A39E98" }}
                  tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`}
                />
                <Tooltip content={<InvestmentRecoveryTooltip />} />
                <ReferenceLine
                  y={0}
                  stroke="#C4A882"
                  strokeDasharray="3 3"
                  label={{
                    value: "Investment recovered",
                    position: "insideTopRight",
                    fontSize: 10,
                    fill: "#6B6560",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="recoveryPosition"
                  name="Recovery position"
                  stroke="#2C2825"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <CashFlowCalculationExplainer month={1} />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Bank cash forecast</CardTitle>
          <p className="text-xs text-[#6B6560]">
            Actual liquidity under the current funding plan. A negative lowest point means
            additional funding is required — not that the business permanently &quot;lost&quot; that
            amount.
          </p>
        </CardHeader>
        <CardContent>
          {health.founderEquityTopUpSuggested.gt(0) ? (
            <div className="mb-4 rounded-lg border border-[#E8E2D9] bg-[#FAF8F5] px-4 py-3 text-sm text-[#6B6560]">
              <p className="font-medium text-[#2C2825]">Founder equity planning total</p>
              <p className="mt-1">
                Entered founder equity ({formatINR(launch.founderEquity)}) is{" "}
                {formatINR(health.founderEquityTopUpSuggested)} below what bank cash needs at the
                lowest point. For planning, use{" "}
                <strong>{formatINR(health.plannedFounderEquityTotal)}</strong> as your full
                founder-side raise — your cash plus friends &amp; family until stake split is
                modeled. Edit on Assumptions → Financing.
              </p>
            </div>
          ) : (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Founder equity ({formatINR(launch.founderEquity)}) covers launch and early bank cash
              under this plan.
            </div>
          )}

          <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-[#A39E98]">Founder equity (planning total)</p>
              <p className="font-medium text-[#2C2825]">
                {formatINR(health.plannedFounderEquityTotal)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#A39E98]">Lowest cash point</p>
              <p className="font-medium text-[#2C2825]">
                {formatINR(health.lowestBankCash)} · Month {health.lowestBankCashMonth}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#A39E98]">Cash required at launch</p>
              <p className="font-medium text-[#2C2825]">
                {formatINR(launch.totalCashRequiredAtLaunch)}
              </p>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bankChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E2D9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#A39E98" }} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#A39E98" }}
                  tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`}
                />
                <Tooltip content={<BankCashTooltip />} />
                <ReferenceLine y={0} stroke="#C4A882" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="bankCashBalance"
                  name="Bank cash"
                  stroke="#6B6560"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Operating cash positive"
          value={
            health.operatingCashPositiveMonth
              ? `Month ${health.operatingCashPositiveMonth}`
              : "Not reached"
          }
          subtitle="First month net operating cash ≥ ₹0"
        />
        <MetricCard
          label="Cash balance turns positive"
          value={
            health.bankCashPositiveMonth != null
              ? `Month ${health.bankCashPositiveMonth}`
              : "Not reached"
          }
          subtitle="First month bank cash ≥ ₹0 under current funding"
        />
        <MetricCard
          label="Initial investment recovered"
          value={
            health.investmentRecoveredMonth
              ? `Month ${health.investmentRecoveredMonth}`
              : "Not reached (36mo)"
          }
          subtitle="Cumulative operating cash crosses payback base"
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Monthly cash detail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#F0EBE3] text-left text-xs text-[#A39E98]">
                  <th className="pb-2 pr-4">Month</th>
                  <th className="pb-2 pr-4">Occupancy</th>
                  <th className="pb-2 pr-4">{OPERATING_CASH_INFLOW_BASIS.columnLabel}</th>
                  <th className="pb-2 pr-4">Outflows</th>
                  <th className="pb-2 pr-4">Net operating</th>
                  <th className="pb-2 pr-4">Recovery position</th>
                  <th className="pb-2">Bank cash</th>
                </tr>
              </thead>
              <tbody>
                {cf.monthly.slice(0, 24).map((m) => {
                  const pos = formatRecoveryPositionInr(m.recoveryPosition.toNumber());
                  return (
                    <tr key={m.month} className="border-b border-[#FAF8F5]">
                      <td className="py-1.5 pr-4">{m.month}</td>
                      <td className="py-1.5 pr-4">{m.occupancyPct.toFixed(0)}%</td>
                      <td className="py-1.5 pr-4">{formatINR(m.cashInflows)}</td>
                      <td className="py-1.5 pr-4">{formatINR(m.cashOutflows)}</td>
                      <td
                        className={`py-1.5 pr-4 ${m.netOperatingCashFlow.gte(0) ? "text-[#3D5C3D]" : "text-[#8B3A3A]"}`}
                      >
                        {formatINR(m.netOperatingCashFlow)}
                      </td>
                      <td className="py-1.5 pr-4" title={pos.label}>
                        {formatINR(m.recoveryPosition.toNumber())}
                      </td>
                      <td className="py-1.5">{formatINR(m.bankCashBalance)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
