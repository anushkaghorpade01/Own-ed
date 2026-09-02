"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useFinanceModel } from "@/hooks/use-finance-model";
import { SectionHeader, SampleBanner } from "@/components/shared/metric-card";
import { formatINR, formatPercent } from "@/lib/format/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableHeaderWithTooltip, MetricLabel } from "@/components/ui/info-tooltip";
import {
  PLANNING_NET_PROFIT_TOOLTIP,
  PROFIT_VIEWS_GUIDE_HREF,
  STEADY_STATE_PL_TOOLTIP,
  INCOME_TAX_LINE_TOOLTIP,
  incomeTaxLineLabel,
} from "@/lib/finance/profit-view-copy";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import type { YearlyPLRow } from "@/lib/finance/engine/yearly-pl";
import {
  ExpandablePLRow,
  ExpandableYearlyGroup,
  YearlyDetailRow,
} from "@/components/finance/pl-expandable-rows";
import {
  getDepreciationBreakdown,
  getDirectCostBreakdown,
  getNetSalesBreakdown,
  getOperatingExpenseBreakdown,
} from "@/lib/finance/pl-breakdown";

function YearlyRow({
  label,
  years,
  pick,
  pickYoy,
  bold,
  indent,
  negative,
}: {
  label: string;
  years: YearlyPLRow[];
  pick: (y: YearlyPLRow) => import("decimal.js").default;
  pickYoy?: (y: YearlyPLRow) => import("decimal.js").default | null;
  bold?: boolean;
  indent?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[1fr_repeat(var(--year-cols),minmax(0,1fr))] gap-2 py-1.5 ${indent ? "pl-4" : ""} ${bold ? "border-t border-[#E8E2D9] pt-2 font-medium" : ""}`}
    >
      <span className={bold ? "text-[#2C2825]" : "text-[#6B6560]"}>{label}</span>
      {years.map((y) => {
        const val = pick(y);
        const formatted = negative ? `(${formatINR(val.abs())})` : formatINR(val);
        const yoy = pickYoy?.(y);
        const yoyLabel =
          yoy !== undefined && yoy !== null
            ? `${yoy.gte(0) ? "+" : ""}${formatPercent(yoy)} YoY`
            : undefined;

        return (
          <div key={y.year} className="text-right">
            <div>{formatted}</div>
            {yoyLabel && <div className="text-[10px] text-[#A39E98]">{yoyLabel}</div>}
          </div>
        );
      })}
    </div>
  );
}

export default function PLPage() {
  const model = useFinanceModel();
  const [view, setView] = useState<"monthly" | "yearly">("monthly");
  const pl = model.pl;
  const yearly = model.yearlyPL;
  const yearCols = yearly.years.length;

  const netSalesBreakdown = useMemo(
    () => getNetSalesBreakdown(model.revenue, pl),
    [model.revenue, pl]
  );
  const directCostBreakdown = useMemo(
    () => getDirectCostBreakdown(model.directCosts, model.assumptions),
    [model.directCosts, model.assumptions]
  );
  const operatingExpenseBreakdown = useMemo(
    () => getOperatingExpenseBreakdown(model.operatingExpenses, model.assumptions),
    [model.operatingExpenses, model.assumptions]
  );
  const depreciationBreakdown = useMemo(
    () => getDepreciationBreakdown(model.assumptions),
    [model.assumptions]
  );
  const taxRatePct = model.assumptions.incomeTaxRatePct;
  const incomeTaxLabel = incomeTaxLineLabel(taxRatePct);

  return (
    <div>
      <SectionHeader
        title="Profit & Loss"
        description="Founder planning profit — net sales after GST minus delivery costs, operating costs, and taxes. Click any grouped line to see the breakup."
        action={
          <div className="flex gap-1 rounded-lg border border-[#E8E2D9] p-0.5">
            <Button
              type="button"
              size="sm"
              variant={view === "monthly" ? "default" : "ghost"}
              onClick={() => setView("monthly")}
            >
              Steady-state
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === "yearly" ? "default" : "ghost"}
              onClick={() => setView("yearly")}
            >
              Yearly
            </Button>
          </div>
        }
      />
      <SampleBanner />

      {view === "monthly" ? (
        <Card>
          <CardHeader>
            <MetricLabel
              label="Steady-state monthly P&L · target occupancy"
              tooltip={STEADY_STATE_PL_TOOLTIP}
              className="text-base font-semibold text-[#2C2825]"
            />
            <p className="text-xs text-[#6B6560]">
              A representative month at your target booked occupancy (
              {formatPercent(model.assumptions.projectedBookedOccupancyPct)}). This is different
              from a specific month in your ramp-up forecast — see{" "}
              <Link href="/math/sales-target" className="underline">
                Sales &amp; Client Target
              </Link>{" "}
              for Month X forecast profit.
            </p>
          </CardHeader>
          <CardContent className="text-sm">
            <ExpandablePLRow
              label="Net sales (after GST)"
              value={formatINR(pl.netRevenue)}
              bold
              breakdown={netSalesBreakdown}
            />

            <div className="my-3" />
            <ExpandablePLRow
              label="Direct costs"
              value={`(${formatINR(pl.directCosts)})`}
              indent
              breakdown={directCostBreakdown}
            />
            <ExpandablePLRow label="Contribution" value={formatINR(pl.grossProfit)} bold />
            <ExpandablePLRow
              label="Contribution margin"
              value={formatPercent(pl.grossMarginPct)}
              indent
            />

            <div className="my-3" />
            <ExpandablePLRow
              label="Operating expenses"
              value={`(${formatINR(pl.operatingExpenses)})`}
              indent
              breakdown={operatingExpenseBreakdown}
            />
            <ExpandablePLRow label="Operating profit / EBITDA" value={formatINR(pl.ebitda)} bold />
            <ExpandablePLRow
              label="Depreciation & amortisation"
              value={`(${formatINR(pl.depreciation)})`}
              indent
              breakdown={depreciationBreakdown.length > 0 ? depreciationBreakdown : undefined}
            />
            <ExpandablePLRow
              label="Interest expense"
              value={`(${formatINR(pl.interestExpense)})`}
              indent
            />
            <ExpandablePLRow
              label={
                <span className="inline-flex items-center gap-1.5">
                  {incomeTaxLabel}
                  <InfoTooltip content={INCOME_TAX_LINE_TOOLTIP} label="How income tax is calculated" />
                </span>
              }
              value={
                pl.incomeTax.isPositive()
                  ? `(${formatINR(pl.incomeTax)})`
                  : formatINR(pl.incomeTax)
              }
              indent
            />
            <ExpandablePLRow label="Planning net profit" value={formatINR(pl.netProfit)} bold />
            <p className="text-caption mt-1 pl-0 text-[var(--text-muted)]">{PLANNING_NET_PROFIT_TOOLTIP}</p>
            <p className="text-caption mt-2 text-[var(--text-muted)]">
              <Link href={PROFIT_VIEWS_GUIDE_HREF} className="underline hover:text-[var(--text-primary)]">
                How is this different from Month X forecast profit?
              </Link>
            </p>
            <ExpandablePLRow
              label="Net profit margin"
              value={formatPercent(
                pl.netProfit.dividedBy(pl.netRevenue.isZero() ? 1 : pl.netRevenue).times(100)
              )}
              indent
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card style={{ ["--year-cols" as string]: yearCols }}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Yearly P&L (Operating Years)</CardTitle>
              <Badge variant="secondary">
                {yearCols}-year forecast · {yearly.trend} margins
              </Badge>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="mb-2 grid grid-cols-[1fr_repeat(var(--year-cols),minmax(0,1fr))] gap-2 border-b border-[#E8E2D9] pb-2 text-xs font-medium text-[#A39E98]">
                <span />
                {yearly.years.map((y, i) => {
                  const explanation = yearly.yearExplanations[i];
                  return (
                    <span key={y.year} className="text-right">
                      <TableHeaderWithTooltip
                        label={`YEAR ${y.year}`}
                        tooltip={explanation?.detail ?? `Operating year ${y.year}`}
                        align="right"
                      />
                    </span>
                  );
                })}
              </div>

              <ExpandableYearlyGroup
                label="Net sales"
                years={yearly.years}
                pick={(y) => y.netRevenue}
                pickYoy={(y) => y.yoyNetRevenuePct}
                bold
              >
                <YearlyDetailRow label="Drop-In" years={yearly.years} pick={(y) => y.dropInRevenue} />
                <YearlyDetailRow
                  label="Credit packs (group)"
                  years={yearly.years}
                  pick={(y) => y.groupClassRevenue}
                />
                <YearlyDetailRow
                  label="Standing Spot"
                  years={yearly.years}
                  pick={(y) => y.standingSpotRevenue}
                />
                <YearlyDetailRow label="Private" years={yearly.years} pick={(y) => y.privateRevenue} />
                <YearlyDetailRow label="Standby" years={yearly.years} pick={(y) => y.standbyRevenue} />
              </ExpandableYearlyGroup>

              <div className="my-3" />
              <ExpandableYearlyGroup
                label="Direct costs"
                years={yearly.years}
                pick={(y) => y.directCosts}
                negative
                indent
              >
                {yearly.years.some((y) => y.instructorDelivery.gt(0)) && (
                  <YearlyDetailRow
                    label="Instructor delivery"
                    years={yearly.years}
                    pick={(y) => y.instructorDelivery}
                    negative
                  />
                )}
                <YearlyDetailRow
                  label="Consumables"
                  years={yearly.years}
                  pick={(y) => y.sessionConsumables}
                  negative
                />
                <YearlyDetailRow
                  label="Payment processing"
                  years={yearly.years}
                  pick={(y) => y.paymentFees}
                  negative
                />
              </ExpandableYearlyGroup>
              <YearlyRow label="Contribution" years={yearly.years} pick={(y) => y.grossProfit} bold />
              <YearlyRow
                label="Contribution margin"
                years={yearly.years}
                pick={(y) => y.grossMarginPct}
                indent
              />

              <div className="my-3" />
              <ExpandableYearlyGroup
                label="Operating expenses"
                years={yearly.years}
                pick={(y) => y.operatingExpenses}
                negative
                indent
              >
                <YearlyDetailRow label="Rent" years={yearly.years} pick={(y) => y.rent} negative />
                <YearlyDetailRow label="Payroll" years={yearly.years} pick={(y) => y.payroll} negative />
                <YearlyDetailRow
                  label="Utilities"
                  years={yearly.years}
                  pick={(y) => y.utilities}
                  negative
                />
                <YearlyDetailRow label="Software" years={yearly.years} pick={(y) => y.software} negative />
                <YearlyDetailRow
                  label="Marketing"
                  years={yearly.years}
                  pick={(y) => y.marketing}
                  negative
                />
                <YearlyDetailRow label="Repairs & maintenance" years={yearly.years} pick={(y) => y.repairs} negative />
                <YearlyDetailRow
                  label="Other operating"
                  years={yearly.years}
                  pick={(y) => y.otherOpex}
                  negative
                />
              </ExpandableYearlyGroup>
              <YearlyRow label="Operating profit / EBITDA" years={yearly.years} pick={(y) => y.ebitda} bold />

              <div className="my-3" />
              <YearlyRow
                label="Depreciation"
                years={yearly.years}
                pick={(y) => y.depreciation}
                indent
                negative
              />
              <YearlyRow
                label="Interest expense"
                years={yearly.years}
                pick={(y) => y.interestExpense}
                indent
                negative
              />
              <div
                className={`grid grid-cols-[1fr_repeat(var(--year-cols),minmax(0,1fr))] gap-2 py-1.5 pl-4`}
              >
                <span className="inline-flex items-center gap-1.5 text-[#6B6560]">
                  {incomeTaxLabel}
                  <InfoTooltip content={INCOME_TAX_LINE_TOOLTIP} label="How income tax is calculated" />
                </span>
                {yearly.years.map((y) => (
                  <div key={y.year} className="text-right text-[#6B6560]">
                    {y.incomeTax.isPositive()
                      ? `(${formatINR(y.incomeTax)})`
                      : formatINR(y.incomeTax)}
                  </div>
                ))}
              </div>
              <ExpandableYearlyGroup
                label="Planning net profit"
                years={yearly.years}
                pick={(y) => y.netProfit}
                pickYoy={(y) => y.yoyNetProfitPct}
                explanations={yearly.yearExplanations}
                showProfitTooltip
                bold
              />
              <YearlyRow
                label="Net profit margin"
                years={yearly.years}
                pick={(y) => y.netProfitMarginPct}
                indent
              />
            </CardContent>
          </Card>

          {yearly.costGrowthDrivers.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base">What is driving cost growth?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-[#6B6560]">
                {yearly.costGrowthDrivers.map((d, i) => (
                  <div key={`${d.year}-${d.label}-${i}`} className="flex justify-between">
                    <span>
                      Year {d.year - 1} → {d.year}: {d.label}
                    </span>
                    <span>+{formatINR(d.change)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Forecast health</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {yearly.forecastHealth.map((h) => (
                <div key={h.year} className="rounded-lg border border-[#E8E2D9] p-3">
                  <p className="text-xs font-medium text-[#A39E98]">YEAR {h.year}</p>
                  <p className="text-lg font-medium text-[#2C2825]">{formatINR(h.netProfit)}</p>
                  <p className="text-sm text-[#6B6560]">Margin {formatPercent(h.marginPct)}</p>
                  <p className="mt-1 text-xs text-[#A39E98]">{h.note}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      <p className="mt-4 text-xs text-[#A39E98]">
        Yearly totals sum months {yearly.years[0]?.startMonth ?? 1}–
        {yearly.years[yearly.years.length - 1]?.endMonth ?? 36} from the same monthly engine — not
        Year 1 × 12. Configure structural changes (reformers, services) under{" "}
        <a href="/math/assumptions" className="underline">
          Assumptions → Forecast structural changes
        </a>
        . Cost escalation and price growth are separate. See{" "}
      </p>
    </div>
  );
}
