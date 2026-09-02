"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useApp } from "@/lib/store/app-store";
import { SectionHeader, SampleBanner } from "@/components/shared/metric-card";
import { FinanceTable, FinanceTableRow } from "@/components/ui/finance-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Explainer } from "@/components/ui/explainer";
import { formatINR, formatPercent } from "@/lib/format/currency";
import {
  runSalesTargetAnalysis,
  evaluateSalesPlan,
  getCoreSalesProducts,
  calculateAcquisitionFunnel,
  buildServiceDemandMixPct,
  type SalesTargetSolution,
  type CapacityStatus,
} from "@/lib/finance/engine/sales-client-target";
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

function ProfitSummary({
  sol,
  targetProfit,
  label,
}: {
  sol: SalesTargetSolution;
  targetProfit: number;
  label: string;
}) {
  const gap = sol.planningNetProfit.toNumber() - targetProfit;
  return (
    <div className="mt-4 grid gap-2 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-2">
      <div className="flex justify-between text-body-sm sm:col-span-2">
        <span className="font-medium">{label}</span>
        <strong className={cn(gap >= 0 ? "text-emerald-800" : "text-red-800")}>
          {formatINR(sol.planningNetProfit)}
        </strong>
      </div>
      <div className="flex justify-between text-body-sm">
        <span>Net sales</span>
        <strong>{formatINR(sol.netSales)}</strong>
      </div>
      <div className="flex justify-between text-body-sm">
        <span>Direct costs</span>
        <strong>{formatINR(sol.directCosts)}</strong>
      </div>
      <div className="flex justify-between text-body-sm">
        <span>Operating expenses</span>
        <strong>{formatINR(sol.operatingExpenses)}</strong>
      </div>
      <div className="flex justify-between text-body-sm sm:col-span-2">
        <span>Gap to target ({formatINR(targetProfit)})</span>
        <strong className={cn(gap >= 0 ? "text-emerald-800" : "text-red-800")}>
          {gap >= 0 ? `+${formatINR(gap)} above` : `${formatINR(Math.abs(gap))} short`}
        </strong>
      </div>
      <div className="flex justify-between text-body-sm">
        <span>Implied occupancy</span>
        <strong>{formatPercent(sol.delivery.impliedOccupancyPct)}</strong>
      </div>
      <div className="flex justify-between text-body-sm">
        <span>Capacity</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-caption",
            CAPACITY_STYLE[sol.delivery.capacityStatus]
          )}
        >
          {CAPACITY_LABEL[sol.delivery.capacityStatus]}
        </span>
      </div>
    </div>
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
        description="Set how many of each product you plan to sell, then see whether you hit your profit target and what capacity that implies."
      />
      <SampleBanner />

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
          <p className="text-label">Current forecast profit</p>
          <p className="text-kpi mt-1">{formatINR(analysis.forecastProfit)}</p>
          <p className="text-caption mt-1 text-[var(--text-muted)]">Month {targetMonth} P&amp;L</p>
        </div>
        <div className="card-surface">
          <p className="text-label">Your target</p>
          <p className="text-kpi mt-1">{formatINR(analysis.targetProfit)}</p>
        </div>
        <div className="card-surface">
          <p className="text-label">Forecast gap to close</p>
          <p className="text-kpi mt-1">
            {analysis.profitGap.lte(0) ? "On target" : formatINR(analysis.profitGap)}
          </p>
        </div>
      </div>

      <section className="card-surface mb-4 border-2 border-[var(--border-subtle)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-label">Your sales plan</p>
            <p className="text-caption mt-1 text-[var(--text-muted)]">
              Enter how many of each you plan to sell this month. Mix should reflect how a real
              studio runs — not one product alone.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={loadForecast}>
              Load current forecast
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={suggestFromServiceMix}>
              Suggest from service mix
            </Button>
          </div>
        </div>

        <p className="text-caption mt-3 text-[var(--text-muted)]">
          Service demand mix weights:{" "}
          {products
            .map((p) => `${p.name} ${serviceMixPct[p.id]?.toFixed(0) ?? 0}%`)
            .join(" · ")}
        </p>

        <div className="mt-4 space-y-3">
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-4">
              <div>
                <span className="text-body-sm">{p.name}</span>
                <span className="text-caption ml-2 text-[var(--text-muted)]">
                  {serviceMixPct[p.id]?.toFixed(0) ?? 0}% of bookings
                </span>
              </div>
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
              Your plan delivers {formatINR(customSol.planningNetProfit)} —{" "}
              {formatINR(profitGap)} above target.
            </>
          ) : (
            <>
              Your plan delivers {formatINR(customSol.planningNetProfit)} —{" "}
              {formatINR(Math.abs(profitGap))} short of target. Adjust quantities above.
            </>
          )}
        </div>

        <ProfitSummary
          sol={customSol}
          targetProfit={targetProfit}
          label="Planning net profit from your mix"
        />
      </section>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <section className="card-surface">
          <p className="text-label">Sales breakdown</p>
          <FinanceTable headers={["Product", "Sales", "Net sales", "Contribution"]}>
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

        <section className="card-surface">
          <p className="text-label">Delivery check</p>
          <div className="mt-3 grid gap-2 text-body-sm">
            <div className="flex justify-between">
              <span>Credits sold</span>
              <strong>{customSol.delivery.creditsSold.toFixed(0)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Expected redemptions (new)</span>
              <strong>{customSol.delivery.expectedRedemptionsFromNewSales.toFixed(0)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Private sessions</span>
              <strong>{customSol.delivery.privateBookings.toFixed(0)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Total reformer demand</span>
              <strong>{customSol.delivery.totalReformerDemand.toFixed(0)} spots</strong>
            </div>
            <div className="flex justify-between">
              <span>Available capacity</span>
              <strong>{customSol.delivery.availableReformerSpots.toFixed(0)} spots</strong>
            </div>
          </div>
          {customSol.delivery.peakTimeWarning && (
            <p className="text-caption mt-3 text-amber-800">{customSol.delivery.peakTimeWarning}</p>
          )}
          {customSol.delivery.futureMonthWarnings.map((w) => (
            <p key={w} className="text-caption mt-2 text-amber-800">
              {w}
            </p>
          ))}
        </section>
      </div>

      {analysis.requiredVsForecast.some((r) => r.gap !== 0) && (
        <section className="card-surface mb-4">
          <p className="text-label">Service-mix suggestion vs forecast</p>
          <p className="text-caption mt-1 text-[var(--text-muted)]">
            If you scaled sales to hit target while keeping your service demand mix — for
            comparison only. Edit your plan above to match what you actually expect to sell.
          </p>
          <FinanceTable
            headers={["Product", "Your plan", "Forecast", "Mix suggestion", "Gap vs forecast"]}
            className="mt-3"
          >
            {products.map((p) => {
              const yours = customQuantities[p.id] ?? 0;
              const row = analysis.requiredVsForecast.find((r) => r.productId === p.id);
              const forecast = row?.forecast ?? 0;
              const suggested = row?.required ?? 0;
              return (
                <FinanceTableRow
                  key={p.id}
                  cells={[
                    p.name,
                    String(yours),
                    String(forecast),
                    String(suggested),
                    String(yours - forecast),
                  ]}
                />
              );
            })}
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
            title: "Your plan drives everything",
            content:
              "Enter Drop-In purchases, pack sales, and Private sessions. Own-ed calculates planning net profit, capacity demand, and gap vs your target from those numbers.",
          },
          {
            title: "Suggest from service mix",
            content:
              "Optional starting point: scales sales to hit your profit target while preserving the service demand mix from Access Products (Drop-In, packs, Private shares). Adjust from there to match what you actually expect.",
          },
        ]}
      />
    </div>
  );
}
