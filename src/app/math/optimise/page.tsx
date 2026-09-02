"use client";

import { useMemo, useState, useDeferredValue, useEffect, useRef } from "react";
import { useApp } from "@/lib/store/app-store";
import { useFinanceModel } from "@/hooks/use-finance-model";
import { SectionHeader } from "@/components/shared/metric-card";
import { Explainer } from "@/components/ui/explainer";
import { FinanceTable, FinanceTableRow } from "@/components/ui/finance-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR, formatPercent } from "@/lib/format/currency";
import {
  runOptimisationAnalysis,
  applyCombinationPath,
  describeLeverStatusChange,
  LEVER_STATUS_HELP,
  type LeverId,
  type LeverStatus,
  type OptimisationObjective,
  type CombinationPath,
} from "@/lib/finance/engine/optimisation";
import { cn } from "@/lib/cn";
import { toast } from "sonner";
import Link from "next/link";

const LEVER_LABELS: Record<LeverId, string> = {
  occupancy: "Occupancy",
  realised_revenue: "Realised revenue / spot",
  pack_pricing: "Pack pricing",
  classes_per_day: "Classes / day",
  reformers: "Reformers",
  fixed_costs: "Fixed costs",
  staff_costs: "Staff costs",
  private_sessions: "Private training",
  duo_sessions: "Duo sessions",
  other_revenue: "Other revenue",
  standing_spot: "Standing Spot",
  standby: "Standby",
};

const LEVER_STATUS_LABEL: Record<LeverStatus, string> = {
  open: "Open",
  prefer_not: "Prefer not",
  locked: "Locked",
};

const LEVER_STATUS_STYLE: Record<LeverStatus, string> = {
  open: "border-emerald-300 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200",
  prefer_not: "border-amber-300 bg-amber-50 text-amber-900 ring-1 ring-amber-200",
  locked: "border-red-300 bg-red-50 text-red-900 ring-1 ring-red-200",
};

const OBJECTIVES: { id: OptimisationObjective; label: string }[] = [
  { id: "balanced", label: "Balanced" },
  { id: "minimise_price", label: "Minimise price increase" },
  { id: "minimise_occupancy", label: "Minimise occupancy" },
  { id: "minimise_capex", label: "Minimise capex" },
  { id: "fastest_payback", label: "Fastest payback" },
];

const FEASIBILITY_STYLE: Record<string, string> = {
  healthy: "bg-emerald-50 text-emerald-800",
  stretch: "bg-amber-50 text-amber-900",
  high_risk: "bg-orange-50 text-orange-900",
  not_feasible: "bg-red-50 text-red-800",
};

function TestScenarioButton({ path, targetLabel }: { path: CombinationPath; targetLabel: string }) {
  const { state, createOptimisationScenario } = useApp();
  const [loading, setLoading] = useState(false);

  const handleTest = () => {
    setLoading(true);
    try {
      const merged = applyCombinationPath(state.assumptions, path);
      const name = `Optimise: ${path.name} → ${targetLabel}`;
      createOptimisationScenario(
        name,
        merged,
        JSON.stringify(path.audit, null, 0)
      );
      toast.success("Draft optimisation scenario created", {
        description: "Compare on Scenario Analysis — Base Case unchanged.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button type="button" size="sm" variant="outline" onClick={handleTest} disabled={loading}>
      Test scenario
    </Button>
  );
}

export default function OptimisePage() {
  const { state } = useApp();
  useFinanceModel();
  const [target, setTarget] = useState(100_000);
  const [objective, setObjective] = useState<OptimisationObjective>("balanced");
  const [leverStatus, setLeverStatus] = useState<Partial<Record<LeverId, LeverStatus>>>({});
  const [lastChange, setLastChange] = useState<{
    lever: LeverId;
    status: LeverStatus;
    message: string;
  } | null>(null);

  const deferredLeverStatus = useDeferredValue(leverStatus);
  const deferredTarget = useDeferredValue(target);
  const deferredObjective = useDeferredValue(objective);

  const isRecalculating =
    leverStatus !== deferredLeverStatus ||
    target !== deferredTarget ||
    objective !== deferredObjective;

  const analysis = useMemo(
    () =>
      runOptimisationAnalysis(state.assumptions, deferredTarget, "net_profit", {
        leverStatus: deferredLeverStatus,
        objective: deferredObjective,
        operationalOccupancyCeiling: 90,
        maxPriceIncreasePct: 20,
      }),
    [state.assumptions, deferredTarget, deferredLeverStatus, deferredObjective]
  );

  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);

  const toggleLever = (lever: LeverId) => {
    const cycle: LeverStatus[] = ["open", "prefer_not", "locked"];
    const current = leverStatus[lever] ?? "open";
    const next = cycle[(cycle.indexOf(current) + 1) % cycle.length];
    const message = describeLeverStatusChange(LEVER_LABELS[lever], next);

    setLeverStatus((prev) => ({ ...prev, [lever]: next }));
    setLastChange({ lever, status: next, message });
    toast(message, {
      description: LEVER_STATUS_HELP[next],
      duration: 3500,
    });

    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setLastChange(null), 6000);
  };

  const gap = analysis.targetGap;
  const bestPath = analysis.combinationPaths[0];

  return (
    <div>
      <SectionHeader
        title="Optimise"
        description="How do you get this business to the profit level you actually want? All paths verified through the canonical finance engine."
      />

      {/* Target input */}
      <section className="card-surface mb-4">
        <p className="text-label">Target monthly net profit</p>
        <div className="mt-2 flex flex-wrap items-end gap-4">
          <div>
            <Input
              type="number"
              value={target}
              onChange={(e) => setTarget(parseInt(e.target.value, 10) || 0)}
              className="text-kpi max-w-[200px]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {OBJECTIVES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setObjective(id)}
                className={cn(
                  "rounded-md px-2 py-1 text-body-sm transition-colors",
                  objective === id
                    ? "bg-[var(--text-primary)] text-white"
                    : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--border-subtle)]"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Lever preferences — moved up for immediate access */}
      <section className="card-surface mb-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-h2">Lever preferences</p>
            <p className="text-body-sm mt-1 text-[var(--text-secondary)]">
              Click any lever to cycle: Open → Prefer not → Locked
            </p>
          </div>
          {isRecalculating && (
            <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-caption text-[var(--text-secondary)] animate-pulse">
              Recalculating paths…
            </span>
          )}
        </div>

        {lastChange && (
          <div
            className={cn(
              "mt-3 rounded-lg border px-3 py-2 text-body-sm transition-all",
              LEVER_STATUS_STYLE[lastChange.status]
            )}
            role="status"
            aria-live="polite"
          >
            <p className="font-medium">{lastChange.message}</p>
            <p className="mt-0.5 text-caption opacity-90">
              {LEVER_STATUS_HELP[lastChange.status]}
            </p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(LEVER_LABELS) as LeverId[]).map((lever) => {
            const status = leverStatus[lever] ?? "open";
            return (
              <button
                key={lever}
                type="button"
                onClick={() => toggleLever(lever)}
                aria-pressed={status !== "open"}
                aria-label={`${LEVER_LABELS[lever]}: ${LEVER_STATUS_LABEL[status]}. Click to change.`}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-caption font-medium transition-all duration-150 active:scale-95",
                  LEVER_STATUS_STYLE[status]
                )}
              >
                <span className="block">{LEVER_LABELS[lever]}</span>
                <span className="mt-0.5 block text-[10px] uppercase tracking-wide opacity-80">
                  {LEVER_STATUS_LABEL[status]}
                </span>
              </button>
            );
          })}
        </div>

        <Explainer
          trigger="What do these states mean?"
          sections={[
            {
              title: "Open",
              content: LEVER_STATUS_HELP.open,
            },
            {
              title: "Prefer not",
              content: LEVER_STATUS_HELP.prefer_not,
            },
            {
              title: "Locked",
              content: LEVER_STATUS_HELP.locked,
            },
          ]}
        />
      </section>

      {/* Current / Target / Gap */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="card-surface">
          <p className="text-label">Current model</p>
          <p className="text-kpi mt-1">{formatINR(analysis.currentModel.netProfit)}</p>
          <p className="text-caption mt-1">EBITDA {formatINR(analysis.currentModel.ebitda)}</p>
        </div>
        <div className="card-surface">
          <p className="text-label">Target</p>
          <p className="text-kpi mt-1">{formatINR(gap.target)}</p>
        </div>
        <div className="card-surface">
          <p className="text-label">Gap</p>
          <p className="text-kpi mt-1">
            {gap.alreadyAchieved ? "Achieved" : formatINR(gap.gap)}
          </p>
          {!gap.alreadyAchieved && (
            <p className="text-caption mt-1">per month to close</p>
          )}
        </div>
      </div>

      {analysis.structuralViability.message && (
        <div className="card-surface mb-4 border-amber-200 bg-amber-50 text-body-sm text-amber-900">
          {analysis.structuralViability.message}
        </div>
      )}

      {/* Best path */}
      {!gap.alreadyAchieved && bestPath && (
        <section className="card-surface mb-4">
          <p className="text-label">Best path to target</p>
          <p className="text-h2 mt-1">{bestPath.name}</p>
          <ul className="mt-2 space-y-1 text-body-sm text-[var(--text-secondary)]">
            {bestPath.changeSummary.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-body-sm">
            <span>
              Projected net profit{" "}
              <strong className="text-tabular">{formatINR(bestPath.projectedNetProfit)}</strong>
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-caption uppercase",
                FEASIBILITY_STYLE[bestPath.feasibility]
              )}
            >
              {bestPath.feasibility.replace("_", " ")}
            </span>
            <span>Capex {formatINR(bestPath.capexRequired)}</span>
            {bestPath.paybackMonth && <span>Payback month {bestPath.paybackMonth}</span>}
          </div>
          <p className="text-body-sm mt-2 text-[var(--text-muted)]">{bestPath.operationalRisk}</p>
          <div className="mt-3 flex gap-2">
            <TestScenarioButton path={bestPath} targetLabel={formatINR(gap.target)} />
            <Link href="/math/scenarios">
              <Button type="button" size="sm" variant="ghost">
                Compare scenarios
              </Button>
            </Link>
          </div>
        </section>
      )}

      {/* Bottleneck */}
      <section className="card-surface mb-4">
        <p className="text-label">What is holding the business back?</p>
        <p className="text-body mt-2 text-[var(--text-primary)]">{analysis.bottleneck.summary}</p>
        <Explainer
          trigger="How is this determined?"
          sections={[
            {
              title: "Method",
              content:
                "Derived from current occupancy vs break-even, realised revenue per spot, fixed cost ratio, capacity utilisation, and peak credit coverage — all from runFinanceModel().",
            },
          ]}
        />
      </section>

      {/* Where to optimise first */}
      <section className="card-surface mb-4">
        <p className="text-h2">Where should I optimise first?</p>
        {analysis.opportunities.length === 0 ? (
          <p className="text-body-sm mt-2 text-[var(--text-secondary)]">
            All levers are locked or deprioritised — unlock at least one lever above to see
            recommendations.
          </p>
        ) : (
          <ol className="mt-3 space-y-3">
            {analysis.opportunities.slice(0, 4).map((o) => (
              <li key={o.rank} className="flex gap-3 text-body-sm">
                <span className="text-label w-6">{o.rank}</span>
                <div>
                  <p className="font-medium text-[var(--text-primary)]">{o.title}</p>
                  <p className="text-[var(--text-secondary)]">
                    Potential +{formatINR(o.potentialImpact)}/mo · {o.difficulty} difficulty ·{" "}
                    {o.confidence} confidence
                  </p>
                  <p className="text-caption">{o.summary}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Profit ceiling */}
      <section className="card-surface mb-4">
        <p className="text-h2">Profit ceiling</p>
        <p className="text-body-sm mt-1 text-[var(--text-secondary)]">
          At 90% occupancy: {formatINR(analysis.structuralViability.maxNetProfitAt90Pct)} net
          profit · At 100%: {formatINR(analysis.structuralViability.maxNetProfitAt100Pct)}
        </p>
        <div className="mt-3 overflow-x-auto">
          <FinanceTable headers={["Occupancy", "Net sales", "EBITDA", "Net profit"]}>
            {analysis.profitCurve.map((row) => (
              <FinanceTableRow
                key={row.occupancyPct}
                cells={[
                  formatPercent(row.occupancyPct, 0),
                  formatINR(row.netRevenue),
                  formatINR(row.ebitda),
                  formatINR(row.netProfit),
                ]}
              />
            ))}
          </FinanceTable>
        </div>
      </section>

      {/* Single lever solvers */}
      {!gap.alreadyAchieved && (
        <section className="card-surface mb-4">
          <p className="text-h2">What would need to change?</p>
          {analysis.singleLeverSolvers.length === 0 ? (
            <p className="text-body-sm mt-2 text-[var(--text-secondary)]">
              No open levers — unlock levers above to see single-lever solutions.
            </p>
          ) : (
            <div className="mt-3 space-y-4">
              {analysis.singleLeverSolvers.map((s) => (
                <div key={s.lever} className="border-b border-[var(--border-subtle)] pb-3 last:border-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-body font-medium">{s.label}</p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-caption uppercase",
                        FEASIBILITY_STYLE[s.feasibility]
                      )}
                    >
                      {s.feasibility.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-body-sm mt-1 text-[var(--text-secondary)]">
                    Current:{" "}
                    {typeof s.currentValue === "number" && s.lever.includes("revenue")
                      ? formatINR(s.currentValue)
                      : s.currentValue}
                    {s.requiredValue !== null && (
                      <>
                        {" "}
                        → Required:{" "}
                        {typeof s.requiredValue === "number" &&
                        (s.lever === "realised_revenue" || s.lever === "pack_pricing")
                          ? formatINR(s.requiredValue)
                          : s.requiredValue}
                      </>
                    )}
                    {s.delta && <> ({s.delta})</>}
                  </p>
                  <p className="text-caption mt-1">{s.message}</p>
                </div>
              ))}
            </div>
          )}
          <p className="text-body-sm mt-3 text-[var(--text-muted)]">{analysis.standbyInsight.message}</p>
        </section>
      )}

      {/* All combination paths */}
      {analysis.combinationPaths.length > 1 && (
        <section className="card-surface mb-4">
          <p className="text-h2">Alternative paths</p>
          <div className="mt-3 space-y-4">
            {analysis.combinationPaths.slice(1).map((path) => (
              <div key={path.id} className="rounded-lg border border-[var(--border-subtle)] p-3">
                <p className="text-body font-medium">{path.name}</p>
                <ul className="mt-1 text-body-sm text-[var(--text-secondary)]">
                  {path.changeSummary.map((l) => (
                    <li key={l}>• {l}</li>
                  ))}
                </ul>
                <p className="text-body-sm mt-2">
                  Net profit {formatINR(path.projectedNetProfit)}
                  {path.verified && " · Verified ✓"}
                </p>
                <div className="mt-2">
                  <TestScenarioButton path={path} targetLabel={formatINR(gap.target)} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Cost optimisation */}
      <section className="card-surface">
        <p className="text-h2">Cost structure review</p>
        <p className="text-body-sm mt-1 text-[var(--text-secondary)]">
          Impact of reductions on net profit — not recommendations to cut blindly.
        </p>
        <div className="mt-3 overflow-x-auto">
          <FinanceTable
            headers={["Cost line", "Current", "Category", "−5%", "−10%", "−15%"]}
          >
            {analysis.costOptimisation.map((row) => (
              <FinanceTableRow
                key={row.key}
                cells={[
                  row.label,
                  formatINR(row.current),
                  row.category.replace(/_/g, " "),
                  row.category === "do_not_cut" ? "—" : formatINR(row.impactAt5Pct),
                  row.category === "do_not_cut" ? "—" : formatINR(row.impactAt10Pct),
                  row.category === "do_not_cut" ? "—" : formatINR(row.impactAt15Pct),
                ]}
              />
            ))}
          </FinanceTable>
        </div>
      </section>
    </div>
  );
}
