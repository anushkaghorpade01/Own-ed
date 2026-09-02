"use client";

import { useEffect, useMemo, useState } from "react";
import { useFinanceModel } from "@/hooks/use-finance-model";
import { runFinanceModel } from "@/lib/finance";
import { formatINR } from "@/lib/format/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CashFlowCalculationExplainer } from "@/components/finance/cash-flow-explainer";
import { InvestmentRecoveryTooltip } from "@/components/finance/cash-flow-chart-tooltips";
import {
  buildRecoveryChartFromOperatingCash,
  computePaybackInvestmentBase,
  estimatePaybackMonth,
  extractInvestmentRecoveryScenarioDefaults,
  scenariosEqual,
  type InvestmentRecoveryScenarioInputs,
} from "@/lib/finance/engine/investment-recovery-scenario";
import { cn } from "@/lib/cn";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function ScenarioNumberField({
  label,
  suffix,
  value,
  onChange,
  integer,
  min,
  max,
  help,
}: {
  label: string;
  suffix?: string;
  value: number;
  onChange: (value: number) => void;
  integer?: boolean;
  min?: number;
  max?: number;
  help?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-[#6B6560]">{label}</label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={String(value)}
          min={min}
          max={max}
          step={integer ? 1 : "any"}
          onChange={(e) => {
            let n = parseFloat(e.target.value);
            if (Number.isNaN(n)) n = 0;
            if (integer) n = Math.round(n);
            if (min != null) n = Math.max(min, n);
            if (max != null) n = Math.min(max, n);
            onChange(n);
          }}
          className="h-9 max-w-[160px]"
        />
        {suffix && <span className="text-xs text-[#A39E98]">{suffix}</span>}
      </div>
      {help && <p className="text-[10px] text-[#A39E98]">{help}</p>}
    </div>
  );
}

function ScenarioCheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 pt-6 text-xs text-[#6B6560]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      {label}
    </label>
  );
}

export function InvestmentRecoveryForecastCard({
  chartVariant = "line",
  description,
  className,
}: {
  chartVariant?: "line" | "area";
  description?: string;
  className?: string;
}) {
  const baseModel = useFinanceModel();
  const savedDefaults = useMemo(
    () => extractInvestmentRecoveryScenarioDefaults(baseModel),
    [baseModel]
  );
  const [scenario, setScenario] = useState<InvestmentRecoveryScenarioInputs>(savedDefaults);

  useEffect(() => {
    setScenario(savedDefaults);
  }, [savedDefaults]);

  const isScenarioActive = !scenariosEqual(scenario, savedDefaults);

  const occupancyOverridesActive =
    scenario.projectedBookedOccupancyPct !== savedDefaults.projectedBookedOccupancyPct ||
    scenario.rampUpStartingOccupancyPct !== savedDefaults.rampUpStartingOccupancyPct ||
    scenario.rampUpMonthsToTarget !== savedDefaults.rampUpMonthsToTarget;

  const monthlyOperatingCash = useMemo(() => {
    const monthly = occupancyOverridesActive
      ? runFinanceModel({
          ...baseModel.assumptions,
          projectedBookedOccupancyPct: scenario.projectedBookedOccupancyPct,
          rampUpStartingOccupancyPct: scenario.rampUpStartingOccupancyPct,
          rampUpMonthsToTarget: scenario.rampUpMonthsToTarget,
        }).cashFlow.monthly
      : baseModel.cashFlow.monthly;
    return monthly.map((m) => m.netOperatingCashFlow.toNumber());
  }, [baseModel, occupancyOverridesActive, scenario, savedDefaults]);

  const paybackInvestmentBase = useMemo(
    () => computePaybackInvestmentBase(scenario),
    [scenario]
  );

  const chartData = useMemo(
    () => buildRecoveryChartFromOperatingCash(monthlyOperatingCash, paybackInvestmentBase),
    [monthlyOperatingCash, paybackInvestmentBase]
  );

  const payback = useMemo(() => estimatePaybackMonth(chartData), [chartData]);

  const patch = (partial: Partial<InvestmentRecoveryScenarioInputs>) => {
    setScenario((prev) => ({ ...prev, ...partial }));
  };

  const defaultDescription =
    "How long cumulative operating cash takes to recover your initial investment. Month 0 = full hurdle. ₹0 line = initial investment fully recovered. Above zero = net cash above investment. Excludes founder equity and loan proceeds.";

  return (
    <Card className={cn(className, isScenarioActive && "ring-2 ring-[#C4A882]/35")}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Investment recovery — 36 month forecast</CardTitle>
            <p className="mt-1 text-xs text-[#6B6560]">{description ?? defaultDescription}</p>
          </div>
          {isScenarioActive && (
            <Badge variant="secondary" className="shrink-0">
              Scenario preview — not saved
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-5 rounded-lg border border-[#E8E2D9] bg-[#FAF8F5] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-[#2C2825]">What drives this curve</p>
              <p className="text-xs text-[#6B6560]">
                Adjust locally to explore payback — changes here do not update Assumptions until
                you save there.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!isScenarioActive}
              onClick={() => setScenario(savedDefaults)}
            >
              Go back to default
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ScenarioNumberField
              label="Non-recoverable capex"
              suffix="₹"
              value={scenario.nonRecoverableCapex}
              onChange={(v) => patch({ nonRecoverableCapex: v })}
              help="Setup spend you need to earn back"
            />
            <ScenarioNumberField
              label="Working capital"
              suffix="₹"
              value={scenario.workingCapital}
              onChange={(v) => patch({ workingCapital: v })}
              help="Cash buffer included in the hurdle"
            />
            <ScenarioNumberField
              label="Security deposit"
              suffix="₹"
              value={scenario.securityDepositAmount}
              onChange={(v) => patch({ securityDepositAmount: v })}
              help="Refundable deposit paid at launch"
            />
            <ScenarioCheckboxField
              label="Include security deposit in payback hurdle"
              checked={scenario.includeRecoverableDepositInPayback}
              onChange={(v) => patch({ includeRecoverableDepositInPayback: v })}
            />
            <ScenarioNumberField
              label="Booked occupancy (ramp target)"
              suffix="%"
              value={scenario.projectedBookedOccupancyPct}
              onChange={(v) => patch({ projectedBookedOccupancyPct: v })}
              min={0}
              max={100}
              help="Steady-state occupancy — drives monthly operating cash"
            />
            <ScenarioNumberField
              label="Starting occupancy"
              suffix="%"
              value={scenario.rampUpStartingOccupancyPct}
              onChange={(v) => patch({ rampUpStartingOccupancyPct: v })}
              min={0}
              max={100}
              help="Month 1 occupancy before ramp"
            />
            <ScenarioNumberField
              label="Months to target occupancy"
              integer
              value={scenario.rampUpMonthsToTarget}
              onChange={(v) => patch({ rampUpMonthsToTarget: v })}
              min={1}
              max={36}
              help="Ramp duration for operating cash growth"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-4 border-t border-[#E8E2D9] pt-3 text-sm">
            <div>
              <p className="text-xs text-[#A39E98]">Investment to recover</p>
              <p className="font-medium text-[#2C2825]">{formatINR(paybackInvestmentBase)}</p>
            </div>
            <div>
              <p className="text-xs text-[#A39E98]">Estimated payback</p>
              <p className="font-medium text-[#2C2825]">
                {payback.paybackNotReached
                  ? "Not reached (36mo)"
                  : payback.paybackMonthEstimate &&
                      payback.paybackMonthEstimate !== payback.paybackMonth
                    ? `~Month ${payback.paybackMonthEstimate}`
                    : `Month ${payback.paybackMonth}`}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#A39E98]">Month 36 position</p>
              <p className="font-medium text-[#2C2825]">
                {formatINR(chartData[chartData.length - 1]?.recoveryPosition ?? 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            {chartVariant === "area" ? (
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E2D9" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#A39E98" }}
                  label={{
                    value: "Month",
                    position: "insideBottom",
                    offset: -2,
                    fontSize: 10,
                    fill: "#A39E98",
                  }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#A39E98" }}
                  tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`}
                />
                <Tooltip content={<InvestmentRecoveryTooltip />} />
                <ReferenceLine
                  y={0}
                  stroke="#C4A882"
                  strokeDasharray="4 4"
                  label={{
                    value: "Recovered",
                    position: "insideTopRight",
                    fontSize: 10,
                    fill: "#6B6560",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="recoveryPosition"
                  name="Recovery position"
                  stroke="#2C2825"
                  fill="#F0EBE3"
                />
              </AreaChart>
            ) : (
              <LineChart data={chartData}>
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
            )}
          </ResponsiveContainer>
        </div>
        <CashFlowCalculationExplainer month={1} />
      </CardContent>
    </Card>
  );
}
