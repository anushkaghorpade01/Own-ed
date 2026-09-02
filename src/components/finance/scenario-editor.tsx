"use client";

import { useMemo } from "react";
import { useApp } from "@/lib/store/app-store";
import { isOptimisationDraftScenario } from "@/lib/finance/scenario-helpers";
import { DebouncedNumberInput } from "@/components/ui/debounced-input";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { runFinanceModel } from "@/lib/finance";
import { formatINR } from "@/lib/format/currency";

const EDIT_FIELDS: Array<{ key: keyof import("@/lib/finance/schemas").FinanceAssumptions; label: string; suffix?: string }> = [
  { key: "projectedBookedOccupancyPct", label: "Occupancy", suffix: "%" },
  { key: "rent", label: "Rent", suffix: "₹" },
  { key: "reformers", label: "Reformers" },
  { key: "classesPerDay", label: "Classes/day" },
];

export function ScenarioEditor({ scenarioId }: { scenarioId: string }) {
  const {
    state,
    updateScenarioAssumptions,
    duplicateScenario,
    archiveScenario,
    renameScenario,
    setAsBaseCase,
  } = useApp();

  const scenario = state.scenarios.find((s) => s.id === scenarioId);
  if (!scenario || scenario.archived) return null;

  const isDraft = isOptimisationDraftScenario(scenario);
  const model = useMemo(() => runFinanceModel(scenario.assumptions), [scenario.assumptions]);

  return (
    <div className={`card-surface space-y-3 ${isDraft ? "border border-dashed border-[#C4A882]" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-h3">{scenario.name}</h3>
          {isDraft && (
            <span className="rounded-full bg-[#FFF8E7] px-2 py-0.5 text-caption text-[#7A5C00]">
              Optimise draft
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!scenario.isBaseCase && (
            <Button type="button" size="sm" variant="outline" onClick={() => setAsBaseCase(scenarioId)}>
              Set as base
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" onClick={() => duplicateScenario(scenarioId)}>
            Duplicate
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => archiveScenario(scenarioId, true)}>
            Archive
          </Button>
        </div>
      </div>
      <Input
        value={scenario.name}
        onChange={(e) => renameScenario(scenarioId, e.target.value)}
        className="max-w-xs"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {EDIT_FIELDS.map(({ key, label, suffix }) => (
          <label key={key} className="text-body-sm">
            <span className="text-label block">{label}</span>
            <div className="flex items-center gap-2">
              <DebouncedNumberInput
                value={String(scenario.assumptions[key] ?? "")}
                onCommit={(v) =>
                  updateScenarioAssumptions(scenarioId, {
                    [key]: v,
                  } as Partial<import("@/lib/finance/schemas").FinanceAssumptions>)
                }
              />
              {suffix && <span className="text-caption">{suffix}</span>}
            </div>
          </label>
        ))}
      </div>
      <div className="grid gap-2 text-body-sm sm:grid-cols-3">
        <span>EBITDA: {formatINR(model.pl.ebitda)}</span>
        <span>Net sales: {formatINR(model.revenue.netRevenue)}</span>
        <span>
          Payback: {model.payback.paybackNotReached ? "36mo+" : `Month ${model.payback.paybackMonth}`}
        </span>
      </div>
    </div>
  );
}
