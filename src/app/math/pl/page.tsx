"use client";

import { useState } from "react";
import { useFinanceModel } from "@/hooks/use-finance-model";
import { SectionHeader, SampleBanner } from "@/components/shared/metric-card";
import { formatINR, formatPercent } from "@/lib/format/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableHeaderWithTooltip, InfoTooltip } from "@/components/ui/info-tooltip";
import type { YearlyPLRow } from "@/lib/finance/engine/yearly-pl";
import type { YearProfitExplanation } from "@/lib/finance/engine/yearly-profit-drivers";

function PLRow({
  label,
  value,
  bold,
  indent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  indent?: boolean;
}) {
  return (
    <div
      className={`flex justify-between py-1.5 ${indent ? "pl-4" : ""} ${bold ? "border-t border-[#E8E2D9] pt-2 font-medium" : ""}`}
    >
      <span className={bold ? "text-[#2C2825]" : "text-[#6B6560]"}>{label}</span>
      <span className={bold ? "text-[#2C2825]" : "text-[#6B6560]"}>{value}</span>
    </div>
  );
}

function YearlyCell({ value, yoy }: { value: string; yoy?: string | null }) {
  return (
    <div className="text-right">
      <div>{value}</div>
      {yoy && <div className="text-[10px] text-[#A39E98]">{yoy}</div>}
    </div>
  );
}

function YearlyNetProfitCell({
  value,
  yoy,
  explanation,
}: {
  value: string;
  yoy?: string | null;
  explanation?: YearProfitExplanation;
}) {
  return (
    <div className="flex items-start justify-end gap-1">
      <div className="text-right">
        <div>{value}</div>
        {yoy && <div className="text-[10px] text-[#A39E98]">{yoy}</div>}
      </div>
      {explanation && explanation.direction !== "baseline" && (
        <InfoTooltip
          content={explanation.detail}
          label={`Why Year ${explanation.year} net profit changed`}
          className="mt-0.5"
        />
      )}
    </div>
  );
}

function YearlyRow({
  label,
  years,
  pick,
  pickYoy,
  bold,
  indent,
  negative,
  explanations,
  showProfitTooltip,
}: {
  label: string;
  years: YearlyPLRow[];
  pick: (y: YearlyPLRow) => import("decimal.js").default;
  pickYoy?: (y: YearlyPLRow) => import("decimal.js").default | null;
  bold?: boolean;
  indent?: boolean;
  negative?: boolean;
  explanations?: YearProfitExplanation[];
  showProfitTooltip?: boolean;
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

        if (showProfitTooltip && explanations) {
          const explanation = explanations.find((e) => e.year === y.year);
          return (
            <YearlyNetProfitCell
              key={y.year}
              value={formatted}
              yoy={yoyLabel}
              explanation={explanation}
            />
          );
        }

        return (
          <YearlyCell key={y.year} value={formatted} yoy={yoyLabel} />
        );
      })}
    </div>
  );
}

export default function PLPage() {
  const model = useFinanceModel();
  const [view, setView] = useState<"monthly" | "yearly">("monthly");
  const pl = model.pl;
  const rev = model.revenue;
  const yearly = model.yearlyPL;
  const yearCols = yearly.years.length;

  return (
    <div>
      <SectionHeader
        title="Profit & Loss"
        description="Founder planning profit — net sales after GST minus delivery costs, operating costs, and taxes. Not statutory accounting."
        action={
          <div className="flex gap-1 rounded-lg border border-[#E8E2D9] p-0.5">
            <Button
              type="button"
              size="sm"
              variant={view === "monthly" ? "default" : "ghost"}
              onClick={() => setView("monthly")}
            >
              Monthly
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
            <CardTitle>Monthly P&L (Projected)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <PLRow label="Group classes (flexible credit)" value={formatINR(rev.groupClassRevenue)} indent />
            <PLRow label="Standing Spot (committed reservation revenue)" value={formatINR(rev.standingSpotRevenue)} indent />
            <PLRow label="Private training" value={formatINR(rev.privateRevenue)} indent />
            <PLRow label="Duo sessions" value={formatINR(rev.duoRevenue)} indent />
            <PLRow label="Workshops" value={formatINR(rev.workshopRevenue)} indent />
            <PLRow label="Gross customer billings" value={formatINR(pl.grossCustomerBillings)} bold />
            <PLRow label="Less: GST collected" value={`(${formatINR(pl.gstCollected)})`} indent />
            <PLRow label="Net sales (after GST)" value={formatINR(pl.netRevenue)} bold />

            <div className="my-3" />
            <PLRow label="Direct costs" value={`(${formatINR(pl.directCosts)})`} indent />
            <PLRow label="Contribution" value={formatINR(pl.grossProfit)} bold />
            <PLRow label="Contribution margin" value={formatPercent(pl.grossMarginPct)} indent />

            <div className="my-3" />
            <PLRow label="Operating expenses" value={`(${formatINR(pl.operatingExpenses)})`} indent />
            <PLRow label="Operating profit / EBITDA" value={formatINR(pl.ebitda)} bold />
            <PLRow label="Depreciation & amortisation" value={`(${formatINR(pl.depreciation)})`} indent />
            <PLRow label="Interest expense" value={`(${formatINR(pl.interestExpense)})`} indent />
            <PLRow label="Planning net profit" value={formatINR(pl.netProfit)} bold />
            <PLRow label="Net profit margin" value={formatPercent(pl.netProfit.dividedBy(pl.netRevenue.isZero() ? 1 : pl.netRevenue).times(100))} indent />
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
              <div
                className="mb-2 grid grid-cols-[1fr_repeat(var(--year-cols),minmax(0,1fr))] gap-2 border-b border-[#E8E2D9] pb-2 text-xs font-medium text-[#A39E98]"
              >
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

              <YearlyRow
                label="Net sales"
                years={yearly.years}
                pick={(y) => y.netRevenue}
                pickYoy={(y) => y.yoyNetRevenuePct}
                bold
              />
              <YearlyRow label="Drop-In" years={yearly.years} pick={(y) => y.dropInRevenue} indent />
              <YearlyRow label="Credit packs (group)" years={yearly.years} pick={(y) => y.groupClassRevenue} indent />
              <YearlyRow label="Standing Spot" years={yearly.years} pick={(y) => y.standingSpotRevenue} indent />
              <YearlyRow label="Private" years={yearly.years} pick={(y) => y.privateRevenue} indent />
              <YearlyRow label="Standby" years={yearly.years} pick={(y) => y.standbyRevenue} indent />

              <div className="my-3" />
              <YearlyRow label="Direct costs" years={yearly.years} pick={(y) => y.directCosts} negative indent />
              <YearlyRow label="Instructor delivery" years={yearly.years} pick={(y) => y.instructorDelivery} negative indent />
              <YearlyRow label="Consumables" years={yearly.years} pick={(y) => y.sessionConsumables} negative indent />
              <YearlyRow label="Payment processing" years={yearly.years} pick={(y) => y.paymentFees} negative indent />
              <YearlyRow label="Contribution" years={yearly.years} pick={(y) => y.grossProfit} bold />
              <YearlyRow label="Contribution margin" years={yearly.years} pick={(y) => y.grossMarginPct} indent />

              <div className="my-3" />
              <YearlyRow label="Operating expenses" years={yearly.years} pick={(y) => y.operatingExpenses} negative indent />
              <YearlyRow label="Rent" years={yearly.years} pick={(y) => y.rent} negative indent />
              <YearlyRow label="Payroll" years={yearly.years} pick={(y) => y.payroll} negative indent />
              <YearlyRow label="Utilities" years={yearly.years} pick={(y) => y.utilities} negative indent />
              <YearlyRow label="Software" years={yearly.years} pick={(y) => y.software} negative indent />
              <YearlyRow label="Marketing" years={yearly.years} pick={(y) => y.marketing} negative indent />
              <YearlyRow label="Repairs & maintenance" years={yearly.years} pick={(y) => y.repairs} negative indent />
              <YearlyRow label="Operating profit / EBITDA" years={yearly.years} pick={(y) => y.ebitda} bold />

              <div className="my-3" />
              <YearlyRow
                label="Planning net profit"
                years={yearly.years}
                pick={(y) => y.netProfit}
                pickYoy={(y) => y.yoyNetProfitPct}
                explanations={yearly.yearExplanations}
                showProfitTooltip
                bold
              />
              <YearlyRow label="Net profit margin" years={yearly.years} pick={(y) => y.netProfitMarginPct} indent />
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
        Yearly totals sum months {yearly.years[0]?.startMonth ?? 1}–{yearly.years[yearly.years.length - 1]?.endMonth ?? 36} from the same monthly engine — not Year 1 × 12. Configure structural changes (reformers, services) under{" "}
        <a href="/math/assumptions" className="underline">
          Assumptions → Forecast structural changes
        </a>
        . Cost escalation and price growth are separate. See{" "}
      </p>
    </div>
  );
}
