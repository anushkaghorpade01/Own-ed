"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/store/app-store";
import { runFinanceModel } from "@/lib/finance";
import {
  compareScenarios,
  calculateKeyDrivers,
  runOneVariableSensitivity,
  runTwoVariableSensitivity,
  SENSITIVITY_INPUT_OPTIONS,
  SENSITIVITY_OUTPUT_OPTIONS,
  type SensitivityInputKey,
  type SensitivityOutputKey,
} from "@/lib/finance/engine/scenarios";
import { ScenarioEditor } from "@/components/finance/scenario-editor";
import {
  isOptimisationDraftScenario,
  resolveBaseAssumptionsForAnalysis,
  resolveScenarioAssumptionsForAnalysis,
} from "@/lib/finance/scenario-helpers";
import { SectionHeader } from "@/components/shared/metric-card";
import { formatINR, formatPercent } from "@/lib/format/currency";
import { OPERATING_CASH_INFLOW_BASIS } from "@/lib/finance/cash-basis";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Decimal from "decimal.js";

type Tab = "overview" | "differences" | "sensitivity" | "drivers" | "access";

const DEFAULT_SCENARIO_IDS = [
  "scenario-conservative",
  "scenario-base",
  "scenario-strong-demand",
];

function fmtVal(key: string, v: unknown): string {
  if (v instanceof Decimal) {
    if (key.includes("Pct") || key.includes("utilisation") || key.includes("Occupancy"))
      return formatPercent(v);
    return formatINR(v);
  }
  if (v === null || v === undefined) return "N/A";
  return String(v);
}

const COMPARISON_ROWS: Array<{
  label: string;
  key: keyof import("@/lib/finance/engine/scenarios").ScenarioDetailMetrics;
}> = [
  { label: "Reformers", key: "reformers" },
  { label: "Classes/day", key: "classesPerDay" },
  { label: "Operating days/week", key: "operatingDaysPerWeek" },
  { label: "Available capacity (seats/mo)", key: "monthlyAvailableSeats" },
  { label: "Occupied seats/mo", key: "occupiedSeatsMonthly" },
  { label: "Occupancy", key: "occupancyPct" },
  { label: "Peak occupancy", key: "peakOccupancyPct" },
  { label: "Avg realised revenue/credit", key: "avgRealisedRevenuePerCredit" },
  { label: OPERATING_CASH_INFLOW_BASIS.scenarioLabel, key: "grossBillingsEarnedTiming" },
  { label: "Planning net sales", key: "earnedNetRevenue" },
  { label: "Contribution/seat", key: "contributionMarginPerSeat" },
  { label: "EBITDA", key: "ebitda" },
  { label: "Net profit", key: "netProfit" },
  { label: "Monthly operating cash flow", key: "monthlyOperatingCashFlow" },
  { label: "Break-even occupancy", key: "breakEvenOccupancyPct" },
  { label: "Payback (cumulative cash)", key: "paybackMonth" },
  { label: "Simplified payback (ref only)", key: "simplifiedPaybackMonths" },
  { label: "Capacity utilisation", key: "utilisationPct" },
  { label: "Credit coverage ratio", key: "creditCoverageRatio" },
  { label: "Standing Spot share", key: "standingSpotSharePct" },
  { label: "Committed class occupancy", key: "committedOccupancyPct" },
  { label: "Flexible capacity/class", key: "flexibleCapacityRemaining" },
  { label: "Standby expected claims/mo", key: "standbyExpectedClaims" },
  { label: "Private/Duo revenue", key: "privateDuoContribution" },
];

export default function ScenariosPage() {
  const {
    state,
    createScenarioFromBase,
    duplicateScenario,
    archiveScenario,
    setAsBaseCase,
    saveScenarioOutputs,
  } = useApp();

  const [tab, setTab] = useState<Tab>("overview");
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const ids = DEFAULT_SCENARIO_IDS.filter((id) =>
      state.scenarios.some((s) => s.id === id && !s.archived)
    );
    return ids.length > 0 ? ids : state.scenarios.filter((s) => !s.archived).slice(0, 3).map((s) => s.id);
  });
  const [focusId, setFocusId] = useState<string>("scenario-base");
  const [sensInput, setSensInput] = useState<SensitivityInputKey>("occupancy");
  const [sensOutput, setSensOutput] = useState<SensitivityOutputKey>("ebitda");
  const [sensInput2, setSensInput2] = useState<SensitivityInputKey>("realisedRevenue");
  const [twoVarOutput, setTwoVarOutput] = useState<SensitivityOutputKey>("ebitda");
  const [newScenarioName, setNewScenarioName] = useState("");

  const activeScenarios = state.scenarios.filter((s) => !s.archived);
  const baseScenario =
    activeScenarios.find((s) => s.isBaseCase) ?? activeScenarios[0];
  const editableScenarios = activeScenarios.filter((s) => !s.isBaseCase);
  const optimisationDrafts = editableScenarios.filter(isOptimisationDraftScenario);
  const manualScenarios = editableScenarios.filter((s) => !isOptimisationDraftScenario(s));
  const baseAssumptions = useMemo(
    () => resolveBaseAssumptionsForAnalysis(state.assumptions, baseScenario),
    [state.assumptions, baseScenario]
  );

  const comparison = useMemo(() => {
    const selected = activeScenarios.filter((s) => selectedIds.includes(s.id));
    return compareScenarios(
      baseAssumptions,
      selected.map((scenario) =>
        resolveScenarioAssumptionsForAnalysis(scenario, state.assumptions)
      )
    );
  }, [activeScenarios, selectedIds, baseAssumptions, state.assumptions]);

  const focusAnalysis = useMemo(() => {
    const scenario = activeScenarios.find((s) => s.id === focusId);
    if (!scenario) return null;
    return comparison.find((c) => c.metrics.name === scenario.assumptions.name) ?? comparison[0];
  }, [activeScenarios, focusId, comparison]);

  const keyDrivers = useMemo(
    () => calculateKeyDrivers(baseAssumptions),
    [baseAssumptions]
  );

  const oneVarSens = useMemo(() => {
    const inputDef = SENSITIVITY_INPUT_OPTIONS.find((o) => o.key === sensInput)!;
    return runOneVariableSensitivity(
      baseAssumptions,
      sensInput,
      sensOutput,
      inputDef.defaultValues
    );
  }, [baseAssumptions, sensInput, sensOutput]);

  const chartData = oneVarSens.map((row) => ({
    x: row.inputValue,
    y: row.outputValue.toNumber(),
  }));

  const twoVarSens = useMemo(() => {
    const xDef = SENSITIVITY_INPUT_OPTIONS.find((o) => o.key === sensInput)!;
    const yDef = SENSITIVITY_INPUT_OPTIONS.find((o) => o.key === sensInput2)!;
    return {
      xValues: xDef.defaultValues,
      yValues: yDef.defaultValues,
      cells: runTwoVariableSensitivity(
        baseAssumptions,
        sensInput,
        sensInput2,
        twoVarOutput,
        xDef.defaultValues,
        yDef.defaultValues
      ),
    };
  }, [baseAssumptions, sensInput, sensInput2, twoVarOutput]);

  const baseModel = useFinanceModelSafe(baseAssumptions);

  const toggleScenario = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  const accessMixScenarios = useMemo(() => {
    const mixes = [
      { name: "100% flexible", mix: { flexiblePackPct: 100, standingSpotPct: 0, dropInPct: 0, standbyPct: 0, privateDuoPct: 0, trialPct: 0 } },
      { name: "70% flex / 20% SS / 10% drop-in", mix: { flexiblePackPct: 70, standingSpotPct: 20, dropInPct: 10, standbyPct: 0, privateDuoPct: 0, trialPct: 0 } },
      { name: "65% flex / 15% SS / 10% drop-in / 10% standby", mix: { flexiblePackPct: 65, standingSpotPct: 15, dropInPct: 10, standbyPct: 10, privateDuoPct: 0, trialPct: 0 } },
    ];
    return mixes.map(({ name, mix }) => {
      const assumptions = { ...baseAssumptions, accessProductMix: mix, name };
      const model = runFinanceModel(assumptions);
      return {
        name,
        ebitda: model.pl.ebitda,
        netRevenue: model.revenue.netRevenue,
        utilisation: model.summary.utilisationPct,
        reservationValue:
          model.accessProducts.standingSpot?.financialOutputs.capacityReservationValue ??
          new Decimal(0),
        creditCoverage: model.creditLiability.eligibleCoverageRatio,
        standbyIncremental:
          model.accessProducts.standby?.financialOutputs.netIncrementalContribution ??
          new Decimal(0),
      };
    });
  }, [baseAssumptions]);

  return (
    <div>
      <SectionHeader
        title="Scenario Analysis"
        description="What happens to the entire business when assumptions change — all outputs from the central finance engine."
        action={
          <div className="flex gap-2">
            <Input
              placeholder="New scenario name"
              value={newScenarioName}
              onChange={(e) => setNewScenarioName(e.target.value)}
              className="w-40 text-xs"
            />
            <Button
              size="sm"
              onClick={() => {
                if (newScenarioName.trim()) {
                  createScenarioFromBase(newScenarioName.trim(), baseScenario?.id);
                  setNewScenarioName("");
                }
              }}
            >
              + New Scenario
            </Button>
          </div>
        }
      />

      <div className="mb-4 space-y-3">
        {manualScenarios.map((s) => (
          <ScenarioEditor key={s.id} scenarioId={s.id} />
        ))}
        {optimisationDrafts.length > 0 && (
          <div className="rounded-lg border border-dashed border-[#C4A882] bg-[#FFFBF5] p-3">
            <p className="text-label mb-2">Drafts from Optimise</p>
            <p className="text-caption mb-3 text-[#6B6560]">
              These were created when someone clicked <strong>Test scenario</strong> on the Optimise
              page. They do not change Base Case. Archive any you do not need.
            </p>
            <div className="space-y-3">
              {optimisationDrafts.map((s) => (
                <ScenarioEditor key={s.id} scenarioId={s.id} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        {(
          [
            ["overview", "Overview"],
            ["differences", "Differences"],
            ["sensitivity", "Sensitivity"],
            ["drivers", "Key drivers"],
            ["access", "Access mix"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              tab === key ? "bg-[#2C2825] text-[#FAF8F5]" : "bg-[#F0EBE3] text-[#6B6560]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {activeScenarios.map((s) => {
          const isDraft = isOptimisationDraftScenario(s);
          return (
            <div key={s.id} className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => toggleScenario(s.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedIds.includes(s.id)
                    ? "bg-[#2C2825] text-[#FAF8F5]"
                    : "bg-[#F0EBE3] text-[#6B6560] hover:text-[#2C2825]"
                } ${isDraft ? "border border-dashed border-[#C4A882]" : ""}`}
              >
                {s.name}
                {s.isBaseCase && " ★"}
                {isDraft && !s.isBaseCase && " · draft"}
              </button>
              {isDraft && (
                <button
                  type="button"
                  aria-label={`Archive ${s.name}`}
                  title="Archive this Optimise draft"
                  onClick={() => {
                    archiveScenario(s.id, true);
                    setSelectedIds((prev) => prev.filter((id) => id !== s.id));
                  }}
                  className="rounded-md px-1.5 py-1 text-xs text-[#8B3A3A] hover:bg-[#FCEAEA]"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {tab === "overview" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Scenario comparison</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="border-b border-[#F0EBE3] text-left text-xs text-[#A39E98]">
                    <th className="pb-2 pr-4">Metric</th>
                    {comparison.map((c) => (
                      <th key={c.metrics.name} className="pb-2 pr-4">{c.metrics.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row) => (
                    <tr key={row.key} className="border-b border-[#FAF8F5]">
                      <td className="py-2 pr-4 text-[#6B6560]">{row.label}</td>
                      {comparison.map((c) => (
                        <td key={c.metrics.name} className="py-2 pr-4">
                          {row.key === "occupancyPct" || row.key === "peakOccupancyPct" || row.key === "standingSpotSharePct"
                            ? `${c.metrics[row.key]}%`
                            : row.key === "paybackMonth" || row.key === "simplifiedPaybackMonths"
                              ? c.metrics.paybackNotReached && row.key === "paybackMonth"
                                ? "Not reached"
                                : c.metrics[row.key] ?? "N/A"
                              : fmtVal(row.key, c.metrics[row.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {focusAnalysis && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Scenario summary — {focusAnalysis.metrics.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[#6B6560]">
                {focusAnalysis.summary.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                {focusAnalysis.warnings.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-medium uppercase text-[#A39E98]">Constraint warnings</p>
                    {focusAnalysis.warnings.map((w) => (
                      <div
                        key={w.title}
                        className={`rounded-lg p-3 text-xs ${
                          w.severity === "critical"
                            ? "bg-[#FCEAEA] text-[#8B3A3A]"
                            : w.severity === "warning"
                              ? "bg-[#FFF8E7] text-[#7A5C00]"
                              : "bg-[#F0EBE3] text-[#6B6560]"
                        }`}
                      >
                        <p className="font-medium">{w.title}</p>
                        <p className="mt-1">{w.explanation}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Scenario actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <select
                className="rounded-md border border-[#E8E2D9] px-2 py-1 text-xs"
                value={focusId}
                onChange={(e) => setFocusId(e.target.value)}
              >
                {activeScenarios.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <Button variant="outline" size="sm" onClick={() => duplicateScenario(focusId)}>
                Duplicate
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAsBaseCase(focusId)}>
                Set as Base Case
              </Button>
              <Button variant="outline" size="sm" onClick={() => saveScenarioOutputs(focusId)}>
                Save outputs
              </Button>
              <Button variant="outline" size="sm" onClick={() => archiveScenario(focusId, true)}>
                Archive
              </Button>
            </CardContent>
          </Card>

          {baseModel && (
            <p className="mt-4 text-xs text-[#A39E98]">
              Base Case reconciles with Math Overview: earned net revenue {formatINR(baseModel.revenue.netRevenue)}, EBITDA {formatINR(baseModel.pl.ebitda)}.
            </p>
          )}
        </>
      )}

      {tab === "differences" && (
        <Card>
          <CardHeader>
            <CardTitle>Assumption differences from Base Case</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {comparison
              .filter((c) => c.metrics.name !== baseAssumptions.name)
              .map((c) => (
                <div key={c.metrics.name}>
                  <h3 className="font-medium text-[#2C2825]">{c.metrics.name}</h3>
                  {c.diffs.length === 0 ? (
                    <p className="mt-1 text-sm text-[#A39E98]">No tracked differences from Base Case.</p>
                  ) : (
                    <table className="mt-2 w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-[#A39E98]">
                          <th className="py-1 pr-4">Assumption</th>
                          <th className="py-1 pr-4">Base Case</th>
                          <th className="py-1 pr-4">Scenario</th>
                          <th className="py-1">Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.diffs.map((d) => (
                          <tr key={d.field} className="border-t border-[#F0EBE3]">
                            <td className="py-2 pr-4">{d.label}</td>
                            <td className="py-2 pr-4 text-[#6B6560]">{d.baseValue}</td>
                            <td className="py-2 pr-4">{d.scenarioValue}</td>
                            <td className="py-2 font-medium">{d.delta}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {tab === "sensitivity" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>One-variable sensitivity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-wrap gap-4">
                <div>
                  <label className="text-xs text-[#A39E98]">Input variable</label>
                  <select
                    className="mt-1 block rounded-md border border-[#E8E2D9] px-2 py-1 text-sm"
                    value={sensInput}
                    onChange={(e) => setSensInput(e.target.value as SensitivityInputKey)}
                  >
                    {SENSITIVITY_INPUT_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#A39E98]">Output metric</label>
                  <select
                    className="mt-1 block rounded-md border border-[#E8E2D9] px-2 py-1 text-sm"
                    value={sensOutput}
                    onChange={(e) => setSensOutput(e.target.value as SensitivityOutputKey)}
                  >
                    {SENSITIVITY_OUTPUT_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE3" />
                    <XAxis dataKey="x" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => formatINR(Number(v ?? 0))} />
                    <Line type="monotone" dataKey="y" stroke="#2C2825" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <table className="mt-4 w-full text-xs">
                <thead>
                  <tr className="text-[#A39E98]">
                    <th className="py-1 text-left">Input</th>
                    <th className="py-1 text-right">Output</th>
                  </tr>
                </thead>
                <tbody>
                  {oneVarSens.map((row) => (
                    <tr key={row.inputValue} className="border-t border-[#F0EBE3]">
                      <td className="py-1">{row.inputValue}</td>
                      <td className="py-1 text-right">{formatINR(row.outputValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Two-variable sensitivity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-wrap gap-4">
                <div>
                  <label className="text-xs text-[#A39E98]">X axis</label>
                  <select
                    className="mt-1 block rounded-md border border-[#E8E2D9] px-2 py-1 text-sm"
                    value={sensInput}
                    onChange={(e) => setSensInput(e.target.value as SensitivityInputKey)}
                  >
                    {SENSITIVITY_INPUT_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#A39E98]">Y axis</label>
                  <select
                    className="mt-1 block rounded-md border border-[#E8E2D9] px-2 py-1 text-sm"
                    value={sensInput2}
                    onChange={(e) => setSensInput2(e.target.value as SensitivityInputKey)}
                  >
                    {SENSITIVITY_INPUT_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#A39E98]">Cell metric</label>
                  <select
                    className="mt-1 block rounded-md border border-[#E8E2D9] px-2 py-1 text-sm"
                    value={twoVarOutput}
                    onChange={(e) => setTwoVarOutput(e.target.value as SensitivityOutputKey)}
                  >
                    {SENSITIVITY_OUTPUT_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="py-2 pr-2 text-left text-[#A39E98]">
                        {SENSITIVITY_INPUT_OPTIONS.find((o) => o.key === sensInput)?.label} ↓ / {SENSITIVITY_INPUT_OPTIONS.find((o) => o.key === sensInput2)?.label} →
                      </th>
                      {twoVarSens.yValues.map((y) => (
                        <th key={y} className="px-2 py-2 text-right text-[#A39E98]">{y}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {twoVarSens.xValues.map((x, ri) => (
                      <tr key={x} className="border-t border-[#F0EBE3]">
                        <td className="py-2 pr-2 font-medium">{x}</td>
                        {twoVarSens.cells[ri].map((cell, ci) => (
                          <td
                            key={ci}
                            className={`px-2 py-2 text-right ${cell.gte(0) ? "text-[#2C2825]" : "text-[#8B3A3A]"}`}
                          >
                            {formatINR(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "drivers" && (
        <Card>
          <CardHeader>
            <CardTitle>What moves the business most?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-[#6B6560]">
              Ranked model sensitivities on EBITDA — not proven causal relationships.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#F0EBE3] text-left text-xs text-[#A39E98]">
                  <th className="pb-2 pr-4">Rank</th>
                  <th className="pb-2 pr-4">Change</th>
                  <th className="pb-2">EBITDA impact</th>
                </tr>
              </thead>
              <tbody>
                {keyDrivers.map((d) => (
                  <tr key={d.label} className="border-b border-[#FAF8F5]">
                    <td className="py-2 pr-4">{d.rank}</td>
                    <td className="py-2 pr-4 text-[#6B6560]">{d.changeDescription}</td>
                    <td className={`py-2 font-medium ${d.ebitdaImpact.gte(0) ? "text-[#2C2825]" : "text-[#8B3A3A]"}`}>
                      {d.ebitdaImpact.gte(0) ? "+" : ""}{formatINR(d.ebitdaImpact)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {tab === "access" && (
        <Card>
          <CardHeader>
            <CardTitle>Access product mix scenarios</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-[#6B6560]">
              Higher revenue alone does not mean a better scenario — compare capacity, credit coverage, and reservation economics.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#F0EBE3] text-left text-xs text-[#A39E98]">
                  <th className="pb-2 pr-4">Mix</th>
                  <th className="pb-2 pr-4">Earned revenue</th>
                  <th className="pb-2 pr-4">EBITDA</th>
                  <th className="pb-2 pr-4">Utilisation</th>
                  <th className="pb-2 pr-4">SS reservation value</th>
                  <th className="pb-2 pr-4">Credit coverage</th>
                  <th className="pb-2">Standby incremental</th>
                </tr>
              </thead>
              <tbody>
                {accessMixScenarios.map((row) => (
                  <tr key={row.name} className="border-b border-[#FAF8F5]">
                    <td className="py-2 pr-4 font-medium">{row.name}</td>
                    <td className="py-2 pr-4">{formatINR(row.netRevenue)}</td>
                    <td className="py-2 pr-4">{formatINR(row.ebitda)}</td>
                    <td className="py-2 pr-4">{formatPercent(row.utilisation)}</td>
                    <td className="py-2 pr-4">{formatINR(row.reservationValue)}</td>
                    <td className="py-2 pr-4">{row.creditCoverage.toFixed(1)}×</td>
                    <td className="py-2">{formatINR(row.standbyIncremental)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function useFinanceModelSafe(assumptions: import("@/lib/finance/schemas").FinanceAssumptions) {
  return useMemo(() => runFinanceModel(assumptions), [assumptions]);
}
