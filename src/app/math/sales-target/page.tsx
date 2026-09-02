"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useApp } from "@/lib/store/app-store";
import { SectionHeader, SampleBanner } from "@/components/shared/metric-card";
import { FinanceTable, FinanceTableRow } from "@/components/ui/finance-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Explainer } from "@/components/ui/explainer";
import { MetricLabel } from "@/components/ui/info-tooltip";
import * as Tooltip from "@radix-ui/react-tooltip";
import { formatINR, formatPercent } from "@/lib/format/currency";
import {
  MONTH_FORECAST_PROFIT_TOOLTIP,
  PROFIT_VIEWS_GUIDE_HREF,
  SALES_PLAN_PROFIT_TOOLTIP,
} from "@/lib/finance/profit-view-copy";
import {
  COMMERCIAL_RESULT_TITLE,
  CREDITS_CAPACITY_TOOLTIP,
  DELIVERY_CAPACITY_SECTION_TITLE,
  FEASIBILITY_NOT_DEMAND_TOOLTIP,
  FEASIBLE_TOOLTIP,
  LOAD_FORECAST_TOOLTIP,
  SALES_NOT_BOOKINGS_TOOLTIP,
  SUGGEST_FROM_MIX_TOOLTIP,
  THREE_STEP,
  YOUR_SALES_PLAN_CAPTION,
  YOUR_SALES_PLAN_TOOLTIP,
} from "@/lib/finance/sales-plan-copy";
import { getSalesPlanProductLabel } from "@/lib/finance/sales-plan-labels";
import {
  runSalesTargetAnalysis,
  evaluateSalesPlan,
  getCoreSalesProducts,
  calculateAcquisitionFunnel,
  buildServiceDemandMixPct,
  calculateImpliedDeliveryMix,
  type SalesTargetSolution,
  type CapacityStatus,
} from "@/lib/finance/engine/sales-client-target";
import {
  SalesPlanThreeStepExplainer,
  ServiceDemandMixReference,
} from "@/components/finance/sales-plan-explainer";
import { SalesTargetPreferencesSchema } from "@/lib/finance/schemas";
import { cn } from "@/lib/cn";

const CAPACITY_STYLE: Record<CapacityStatus, string> = {
  feasible: "bg-emerald-50 text-emerald-800",
  tight: "bg-amber-50 text-amber-900",
  not_feasible: "bg-red-50 text-red-800",
};

const CAPACITY_LABEL: Record<CapacityStatus, string> = {
  feasible: "Feasible",
  tight: "Tight",
  not_feasible: "Not feasible",
};

const PRESET_TARGETS = [100_000, 200_000, 300_000];

function TooltipButton({
  label,
  tooltip,
  onClick,
}: {
  label: string;
  tooltip: string;
  onClick: () => void;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <Button type="button" variant="outline" size="sm" onClick={onClick}>
          {label}
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="z-50 max-w-xs rounded-md bg-[#2C2825] px-3 py-2 text-xs leading-relaxed text-white shadow-lg"
          sideOffset={4}
        >
          {tooltip.split("\n\n").map((p, i) => (
            <p key={i} className={i > 0 ? "mt-2" : undefined}>
              {p}
            </p>
          ))}
          <Tooltip.Arrow className="fill-[#2C2825]" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function CommercialResult({
  sol,
  targetProfit,
}: {
  sol: SalesTargetSolution;
  targetProfit: number;
}) {
  const gap = sol.planningNetProfit.toNumber() - targetProfit;
  return (
    <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
      <MetricLabel
        label={COMMERCIAL_RESULT_TITLE}
        tooltip={SALES_PLAN_PROFIT_TOOLTIP}
        tooltipLabel="Commercial result"
        className="text-label"
      />
      <p className="text-caption mt-1 text-[var(--text-muted)]">
        If you sell this combination, what does it make?
      </p>
      <div className="mt-3 grid gap-2 text-body-sm sm:grid-cols-2">
        <div className="flex justify-between sm:col-span-2">
          <span>Net sales</span>
          <strong>{formatINR(sol.netSales)}</strong>
        </div>
        <div className="flex justify-between">
          <span>Direct / delivery costs</span>
          <strong>{formatINR(sol.directCosts)}</strong>
        </div>
        <div className="flex justify-between">
          <span>Operating expenses</span>
          <strong>{formatINR(sol.operatingExpenses)}</strong>
        </div>
        <div className="flex justify-between">
          <span>Depreciation</span>
          <strong>{formatINR(sol.plDetail.depreciation)}</strong>
        </div>
        <div className="flex justify-between">
          <span>Interest</span>
          <strong>{formatINR(sol.plDetail.interest)}</strong>
        </div>
        <div className="flex justify-between">
          <span>Tax</span>
          <strong>{formatINR(sol.plDetail.tax)}</strong>
        </div>
        <div className="flex justify-between border-t border-[var(--border-subtle)] pt-2 sm:col-span-2">
          <MetricLabel label="Planning net profit" tooltip={SALES_PLAN_PROFIT_TOOLTIP} />
          <strong className={cn(gap >= 0 ? "text-emerald-800" : "text-red-800")}>
            {formatINR(sol.planningNetProfit)}
          </strong>
        </div>
        <div className="flex justify-between sm:col-span-2">
          <span>Gap / surplus to target ({formatINR(targetProfit)})</span>
          <strong className={cn(gap >= 0 ? "text-emerald-800" : "text-red-800")}>
            {gap >= 0 ? `+${formatINR(gap)} surplus` : `${formatINR(Math.abs(gap))} short`}
          </strong>
        </div>
      </div>
    </div>
  );
}

function DeliveryCapacityCheck({ sol }: { sol: SalesTargetSolution }) {
  const d = sol.delivery;
  return (
    <section className="card-surface">
      <MetricLabel
        label={DELIVERY_CAPACITY_SECTION_TITLE}
        tooltip={THREE_STEP.capacity.tooltip}
        tooltipLabel="Can I actually deliver it?"
        className="text-label"
      />
      <p className="text-caption mt-1 text-[var(--text-muted)]">
        Physical capacity to service what you are selling — separate from commercial value.
      </p>

      <div className="mt-3 grid gap-2 text-body-sm">
        <div className="flex justify-between">
          <MetricLabel label="Credits created" tooltip={SALES_NOT_BOOKINGS_TOOLTIP} />
          <strong>{d.creditsSold.toFixed(0)}</strong>
        </div>
        <div className="flex justify-between">
          <MetricLabel
            label="Expected delivery demand"
            tooltip={CREDITS_CAPACITY_TOOLTIP}
          />
          <strong>{d.totalReformerDemand.toFixed(0)} spots</strong>
        </div>
        <div className="flex justify-between">
          <span>Existing outstanding service demand</span>
          <strong>{d.expectedRedemptionsFromExistingCredits.toFixed(0)}</strong>
        </div>
        <div className="flex justify-between">
          <span>Available capacity</span>
          <strong>{d.availableReformerSpots.toFixed(0)} spots</strong>
        </div>
        <div className="flex justify-between">
          <span>Implied occupancy / utilisation</span>
          <strong>{formatPercent(d.impliedOccupancyPct)}</strong>
        </div>
        <div className="flex justify-between border-t border-[var(--border-subtle)] pt-2">
          <MetricLabel label="Capacity status" tooltip={FEASIBLE_TOOLTIP} />
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-caption font-medium",
              CAPACITY_STYLE[d.capacityStatus]
            )}
          >
            {CAPACITY_LABEL[d.capacityStatus]}
          </span>
        </div>
      </div>

      <p className="text-caption mt-3 text-[var(--text-muted)]">
        <MetricLabel
          label="Feasibility is not customer demand"
          tooltip={FEASIBILITY_NOT_DEMAND_TOOLTIP}
          className="inline text-caption"
        />
      </p>

      {d.peakTimeWarning && (
        <p className="text-caption mt-2 text-amber-800">{d.peakTimeWarning}</p>
      )}
      {d.futureMonthWarnings.map((w) => (
        <p key={w} className="text-caption mt-2 text-amber-800">
          {w}
        </p>
      ))}
    </section>
  );
}

export default function SalesTargetPage() {
  const { state, updateAssumptions } = useApp();
  const prefs = state.assumptions.salesTargetPreferences ?? {
    targetMonthlyNetProfit: 200_000,
    targetMonth: 8,
    solutionMode: "balanced" as const,
    salesMixMode: "auto" as const,
  };

  const [targetProfit, setTargetProfit] = useState(prefs.targetMonthlyNetProfit);
  const [targetMonth, setTargetMonth] = useState(prefs.targetMonth);

  const products = useMemo(
    () => getCoreSalesProducts(state.assumptions),
    [state.assumptions]
  );

  const serviceMixPct = useMemo(
    () => buildServiceDemandMixPct(state.assumptions),
    [state.assumptions]
  );

  const analysis = useMemo(
    () =>
      runSalesTargetAnalysis(state.assumptions, {
        targetMonthlyNetProfit: targetProfit,
        targetMonth,
      }),
    [state.assumptions, targetProfit, targetMonth]
  );

  const parsedPrefs = SalesTargetPreferencesSchema.parse(prefs);
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>(() => {
    const saved = parsedPrefs.customSalesQuantitiesByProductId ?? {};
    if (Object.keys(saved).length > 0) return saved;
    return Object.fromEntries(products.map((p) => [p.id, 0]));
  });

  useEffect(() => {
    setCustomQuantities((prev) => {
      const next = { ...prev };
      for (const p of products) {
        if (next[p.id] == null) next[p.id] = 0;
      }
      return next;
    });
  }, [products]);

  const customSol = useMemo(
    () =>
      evaluateSalesPlan(state.assumptions, customQuantities, targetMonth, targetProfit),
    [state.assumptions, customQuantities, targetMonth, targetProfit]
  );

  const forecastSol = useMemo(() => {
    const qty = Object.fromEntries(
      products.map((p) => [p.id, analysis.forecastSalesByProduct[p.id] ?? 0])
    );
    return evaluateSalesPlan(state.assumptions, qty, targetMonth, targetProfit);
  }, [state.assumptions, products, analysis.forecastSalesByProduct, targetMonth, targetProfit]);

  const impliedMix = useMemo(
    () => calculateImpliedDeliveryMix(customSol),
    [customSol]
  );

  const funnel = calculateAcquisitionFunnel(
    Math.ceil(customSol.clients.newCustomersNeededThisMonth.toNumber()),
    analysis.preferences
  );

  const persistPrefs = (quantities?: Record<string, number>) => {
    updateAssumptions({
      salesTargetPreferences: SalesTargetPreferencesSchema.parse({
        ...prefs,
        targetMonthlyNetProfit: targetProfit,
        targetMonth,
        customSalesQuantitiesByProductId: quantities ?? customQuantities,
      }),
    });
  };

  const applyQuantities = (quantities: Record<string, number>) => {
    setCustomQuantities(quantities);
    persistPrefs(quantities);
  };

  const suggestFromServiceMix = () => {
    const next = Object.fromEntries(
      analysis.suggestedMix.quantities.map((q) => [q.productId, q.quantity])
    );
    applyQuantities(next);
  };

  const loadForecast = () => {
    const next = Object.fromEntries(
      products.map((p) => [p.id, analysis.forecastSalesByProduct[p.id] ?? 0])
    );
    applyQuantities(next);
  };

  const setQuantity = (productId: string, value: number) => {
    const qty = Math.max(0, Math.floor(value));
    setCustomQuantities((prev) => ({ ...prev, [productId]: qty }));
  };

  const profitGap = customSol.planningNetProfit.toNumber() - targetProfit;

  return (
    <div>
      <SectionHeader
        title="Sales & Client Target"
        description="Set a profit target, test any sales combination, and check whether your studio can deliver it."
      />
      <SampleBanner />

      <SalesPlanThreeStepExplainer />

      <div className="mb-4 flex justify-end">
        <Link
          href="/math/review?area=sales_target&new=1"
          className="text-body-sm text-[var(--text-secondary)] underline hover:text-[var(--text-primary)]"
        >
          Flag an issue for Math Review →
        </Link>
      </div>

      <section className="card-surface mb-4">
        <p className="text-label">Target monthly net profit</p>
        <div className="mt-2 flex flex-wrap items-end gap-4">
          <div>
            <span className="text-body-sm text-[var(--text-muted)]">₹</span>
            <Input
              type="number"
              value={targetProfit}
              onChange={(e) => setTargetProfit(parseInt(e.target.value, 10) || 0)}
              onBlur={() => persistPrefs()}
              className="text-kpi mt-1 max-w-[220px]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESET_TARGETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setTargetProfit(preset)}
                className={cn(
                  "rounded-md px-2 py-1 text-body-sm",
                  targetProfit === preset
                    ? "bg-[var(--text-primary)] text-white"
                    : "bg-[var(--surface-muted)] text-[var(--text-secondary)]"
                )}
              >
                {formatINR(preset)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="text-label">Target month</p>
          <Input
            type="number"
            min={1}
            max={36}
            value={targetMonth}
            onChange={(e) => setTargetMonth(parseInt(e.target.value, 10) || 1)}
            onBlur={() => persistPrefs()}
            className="mt-1 max-w-[120px]"
          />
        </div>
      </section>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="card-surface">
          <MetricLabel
            label={`Month ${targetMonth} forecast profit`}
            tooltip={MONTH_FORECAST_PROFIT_TOOLTIP}
            tooltipLabel={`About Month ${targetMonth} forecast profit`}
          />
          <p className="text-kpi mt-1">{formatINR(analysis.forecastProfit)}</p>
          <p className="text-caption mt-1 text-[var(--text-muted)]">
            From OWNED&apos;s forecast assumptions — not your manual sales plan.
          </p>
        </div>
        <div className="card-surface">
          <p className="text-label">Target monthly profit</p>
          <p className="text-kpi mt-1">{formatINR(analysis.targetProfit)}</p>
        </div>
        <div className="card-surface">
          <p className="text-label">
            {analysis.profitSurplus.gt(0) ? "Surplus to target" : "Gap to target"}
          </p>
          <p className="text-kpi mt-1">
            {analysis.profitSurplus.gt(0)
              ? formatINR(analysis.profitSurplus)
              : analysis.profitGap.lte(0)
                ? "On target"
                : formatINR(analysis.profitGap)}
          </p>
        </div>
      </div>

      <p className="text-caption mb-4 text-[var(--text-muted)]">
        <Link href={PROFIT_VIEWS_GUIDE_HREF} className="underline hover:text-[var(--text-primary)]">
          Why is this profit different from my P&L?
        </Link>
      </p>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr,minmax(240px,280px)]">
        <section className="card-surface border-2 border-[var(--border-subtle)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <MetricLabel
                label="Your sales plan"
                tooltip={YOUR_SALES_PLAN_TOOLTIP}
                tooltipLabel="Your sales plan"
                className="text-label"
              />
              <p className="text-caption mt-1 text-[var(--text-muted)]">{YOUR_SALES_PLAN_CAPTION}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <TooltipButton
                label="Load current forecast"
                tooltip={LOAD_FORECAST_TOOLTIP}
                onClick={loadForecast}
              />
              <TooltipButton
                label="Suggest from service mix"
                tooltip={SUGGEST_FROM_MIX_TOOLTIP}
                onClick={suggestFromServiceMix}
              />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {products.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4">
                <span className="text-body-sm font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                  {getSalesPlanProductLabel(p)}
                </span>
                <Input
                  type="number"
                  min={0}
                  value={customQuantities[p.id] ?? 0}
                  onChange={(e) => setQuantity(p.id, parseInt(e.target.value, 10) || 0)}
                  onBlur={() => persistPrefs()}
                  className="max-w-[100px] text-right text-tabular"
                />
              </div>
            ))}
          </div>

          <div
            className={cn(
              "mt-4 rounded-lg px-3 py-2 text-body-sm",
              profitGap >= 0 ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-950"
            )}
          >
            {profitGap >= 0 ? (
              <>
                Commercial result: {formatINR(customSol.planningNetProfit)} —{" "}
                {formatINR(profitGap)} above target.
                {customSol.delivery.capacityStatus === "not_feasible" && (
                  <span className="mt-1 block font-medium text-red-800">
                    Capacity is not feasible — see delivery check below.
                  </span>
                )}
              </>
            ) : (
              <>
                Commercial result: {formatINR(customSol.planningNetProfit)} —{" "}
                {formatINR(Math.abs(profitGap))} short of target.
              </>
            )}
          </div>

          <CommercialResult sol={customSol} targetProfit={targetProfit} />
        </section>

        <ServiceDemandMixReference products={products} mixPct={serviceMixPct} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <section className="card-surface">
          <p className="text-label">Sales breakdown</p>
          <FinanceTable headers={["Product", "Units sold", "Net sales", "Contribution"]}>
            {customSol.productRows.length === 0 ? (
              <FinanceTableRow cells={["Enter quantities above", "—", "—", "—"]} />
            ) : (
              customSol.productRows.map((row) => (
                <FinanceTableRow
                  key={row.productId}
                  cells={[
                    row.productName,
                    String(row.sales),
                    formatINR(row.netSales),
                    formatINR(row.contribution),
                  ]}
                />
              ))
            )}
            <FinanceTableRow
              cells={["Total", "", formatINR(customSol.netSales), ""]}
              className="font-medium"
            />
          </FinanceTable>
        </section>

        <DeliveryCapacityCheck sol={customSol} />
      </div>

      <section className="card-surface mb-4">
        <p className="text-label">Your plan vs forecast</p>
        <p className="text-caption mt-1 text-[var(--text-muted)]">
          Forecast quantities come from OWNED&apos;s expected sales volumes — not booking mix
          percentages.
        </p>
        <FinanceTable
          headers={["", "Forecast", "Your plan"]}
          className="mt-3 max-w-lg"
        >
          {products.map((p) => (
            <FinanceTableRow
              key={p.id}
              cells={[
                getSalesPlanProductLabel(p),
                String(analysis.forecastSalesByProduct[p.id] ?? 0),
                String(customQuantities[p.id] ?? 0),
              ]}
            />
          ))}
          <FinanceTableRow
            cells={["Net sales", formatINR(forecastSol.netSales), formatINR(customSol.netSales)]}
            className="font-medium"
          />
          <FinanceTableRow
            cells={[
              "Planning net profit",
              formatINR(forecastSol.planningNetProfit),
              formatINR(customSol.planningNetProfit),
            ]}
            className="font-medium"
          />
        </FinanceTable>
      </section>

      {impliedMix.length > 0 && (
        <section className="card-surface mb-4">
          <MetricLabel
            label="Your plan's implied delivery mix"
            tooltip={CREDITS_CAPACITY_TOOLTIP}
            tooltipLabel="Implied delivery mix"
            className="text-label"
          />
          <p className="text-caption mt-1 text-[var(--text-muted)]">
            Expected booking/service mix from redemptions — not transaction counts.
          </p>
          <FinanceTable headers={["Service", "Expected delivery demand", "Mix %"]} className="mt-3">
            {impliedMix.map((row) => (
              <FinanceTableRow
                key={row.productId}
                cells={[
                  row.productName,
                  row.deliveryDemand.toFixed(0),
                  formatPercent(row.mixPct),
                ]}
              />
            ))}
          </FinanceTable>
        </section>
      )}

      {funnel && (
        <section className="card-surface mb-4">
          <p className="text-label">Customer acquisition (your plan)</p>
          <div className="mt-2 space-y-1 font-mono text-body-sm">
            {funnel.steps.map((step, i) => (
              <p key={i}>{step}</p>
            ))}
          </div>
        </section>
      )}

      <Explainer
        trigger="How is this calculated?"
        sections={[
          {
            title: "Three separate concepts",
            content:
              "Service Demand Mix is what you expect bookings to look like. Your Sales Plan is any combination you want to test. Capacity Check asks whether the studio can physically deliver the service demand your plan creates.",
          },
          {
            title: "Commercial vs delivery",
            content:
              "Pack net sales count when sold — redemption timing affects capacity, not the commercial sales value. Credits created from packs are used only in the delivery/capacity section.",
          },
        ]}
      />
    </div>
  );
}
