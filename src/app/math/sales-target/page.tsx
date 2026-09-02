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
  type SalesSolutionMode,
  type SalesTargetSolution,
  type CapacityStatus,
} from "@/lib/finance/engine/sales-client-target";
import { SalesTargetPreferencesSchema } from "@/lib/finance/schemas";
import { cn } from "@/lib/cn";

const SOLUTION_MODES: { id: SalesSolutionMode; label: string }[] = [
  { id: "balanced", label: "Balanced" },
  { id: "profit_maximising", label: "Profit maximising" },
  { id: "lowest_client_count", label: "Lowest client count" },
];

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
      <div className="flex justify-between text-body-sm">
        <span>vs target ({formatINR(targetProfit)})</span>
        <strong className={cn(gap >= 0 ? "text-emerald-800" : "text-red-800")}>
          {gap >= 0 ? `+${formatINR(gap)}` : formatINR(gap)}
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
  const [solutionMode, setSolutionMode] = useState<SalesSolutionMode>(prefs.solutionMode);

  const products = useMemo(
    () => getCoreSalesProducts(state.assumptions),
    [state.assumptions]
  );

  const analysis = useMemo(
    () =>
      runSalesTargetAnalysis(state.assumptions, {
        targetMonthlyNetProfit: targetProfit,
        targetMonth,
        solutionMode,
      }),
    [state.assumptions, targetProfit, targetMonth, solutionMode]
  );

  const sol =
    analysis.solutions.find((s) => s.mode === solutionMode) ?? analysis.primarySolution;

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
    Math.ceil(sol.clients.newCustomersNeededThisMonth.toNumber()),
    analysis.preferences
  );

  const persistPrefs = (quantities?: Record<string, number>) => {
    updateAssumptions({
      salesTargetPreferences: SalesTargetPreferencesSchema.parse({
        ...prefs,
        targetMonthlyNetProfit: targetProfit,
        targetMonth,
        solutionMode,
        customSalesQuantitiesByProductId: quantities ?? customQuantities,
      }),
    });
  };

  const applyRecommendedToMix = () => {
    const next = Object.fromEntries(
      sol.quantities.map((q) => [q.productId, q.quantity])
    );
    setCustomQuantities(next);
    persistPrefs(next);
  };

  const setQuantity = (productId: string, value: number) => {
    const qty = Math.max(0, Math.floor(value));
    setCustomQuantities((prev) => {
      const next = { ...prev, [productId]: qty };
      return next;
    });
  };

  return (
    <div>
      <SectionHeader
        title="Sales & Client Target"
        description="Tell Own-ed how much you want the studio to make — or enter your own sales mix and see what profit it produces."
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

        <div className="mt-4">
          <p className="text-label mb-1">Recommended plan — solution mode</p>
          <div className="flex flex-wrap gap-2">
            {SOLUTION_MODES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSolutionMode(id)}
                className={cn(
                  "rounded-md px-2 py-1 text-body-sm",
                  solutionMode === id
                    ? "bg-[var(--text-primary)] text-white"
                    : "bg-[var(--surface-muted)] text-[var(--text-secondary)]"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="card-surface">
          <p className="text-label">Current forecast profit</p>
          <p className="text-kpi mt-1">{formatINR(analysis.forecastProfit)}</p>
        </div>
        <div className="card-surface">
          <p className="text-label">Target</p>
          <p className="text-kpi mt-1">{formatINR(analysis.targetProfit)}</p>
        </div>
        <div className="card-surface">
          <p className="text-label">Profit gap (forecast)</p>
          <p className="text-kpi mt-1">
            {analysis.profitGap.lte(0) ? "On target" : formatINR(analysis.profitGap)}
          </p>
        </div>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <section className="card-surface">
          <p className="text-label">Recommended — to hit your target</p>
          <p className="text-h2 mt-1 capitalize">{solutionMode.replace(/_/g, " ")} plan</p>
          <div className="mt-4 grid gap-2">
            {sol.quantities.map((q) => (
              <div key={q.productId} className="flex justify-between text-body-sm">
                <span>{q.productName}</span>
                <strong className="text-tabular">{q.quantity}</strong>
              </div>
            ))}
          </div>
          <ProfitSummary
            sol={sol}
            targetProfit={targetProfit}
            label="Planning net profit"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={applyRecommendedToMix}
          >
            Copy to your mix below
          </Button>
        </section>

        <section className="card-surface border-2 border-[var(--border-subtle)]">
          <p className="text-label">Your mix — try your own numbers</p>
          <p className="text-caption mt-1 text-[var(--text-muted)]">
            Enter how many of each you plan to sell. Profit updates instantly.
          </p>
          <div className="mt-4 space-y-3">
            {products.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4">
                <span className="text-body-sm">{p.name}</span>
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
          <ProfitSummary
            sol={customSol}
            targetProfit={targetProfit}
            label="Profit from your mix"
          />
        </section>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <section className="card-surface">
          <p className="text-label">Your mix — sales breakdown</p>
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
          <p className="text-label">Your mix — delivery check</p>
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
              <span>Total reformer demand</span>
              <strong>{customSol.delivery.totalReformerDemand.toFixed(0)} spots</strong>
            </div>
            <div className="flex justify-between">
              <span>Available capacity</span>
              <strong>{customSol.delivery.availableReformerSpots.toFixed(0)} spots</strong>
            </div>
          </div>
        </section>
      </div>

      <section className="card-surface mb-4">
        <p className="text-label">Other ways to hit this target</p>
        <div className="mt-3 space-y-4">
          {analysis.solutions
            .filter((s) => s.mode !== solutionMode)
            .map((alt) => (
              <div key={alt.mode} className="rounded-md bg-[var(--surface-muted)] p-3">
                <p className="font-medium capitalize">{alt.mode.replace(/_/g, " ")}</p>
                <p className="text-body-sm mt-1 text-[var(--text-secondary)]">
                  {alt.quantities
                    .filter((q) => q.quantity > 0)
                    .map((q) => `${q.productName}: ${q.quantity}`)
                    .join(" · ")}{" "}
                  → {formatINR(alt.planningNetProfit)} profit
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setSolutionMode(alt.mode);
                    const next = Object.fromEntries(
                      alt.quantities.map((q) => [q.productId, q.quantity])
                    );
                    setCustomQuantities(next);
                    persistPrefs(next);
                  }}
                >
                  Use this plan
                </Button>
              </div>
            ))}
        </div>
      </section>

      {funnel && (
        <section className="card-surface mb-4">
          <p className="text-label">Customer acquisition (recommended plan)</p>
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
            title: "Two directions",
            content:
              "Recommended plan works backwards from your profit target using integer sales (balanced, profit maximising, or lowest client count). Your mix works forwards — enter Drop-In purchases, pack sales, and Private sessions to see planning net profit, capacity demand, and gap vs target.",
          },
        ]}
      />
    </div>
  );
}
