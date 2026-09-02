"use client";

import { useApp } from "@/lib/store/app-store";
import {
  AssumptionSection,
  DraftInlineNumber,
  DraftNumberField,
  useSectionContext,
} from "@/components/finance/assumption-section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CrudSelect } from "@/components/shared/crud-select";
import {
  createDefaultCostEscalations,
  resolveForecastSettings,
} from "@/lib/finance/engine/escalation";
import type { CostEscalationPreset, CostEscalationRule } from "@/lib/finance/schemas";
import { formatINR } from "@/lib/format/currency";

const PRESETS: CostEscalationPreset[] = ["low", "base", "high", "custom"];

type EscalationDraft = {
  forecastYears: number;
  costEscalationPreset: CostEscalationPreset;
  costEscalations: CostEscalationRule[];
  productPriceGrowth: ReturnType<typeof resolveForecastSettings>["productPriceGrowth"];
};

function EscalationSectionBody() {
  const { state } = useApp();
  const a = state.assumptions;
  const { draft, patch } = useSectionContext<EscalationDraft>();
  const rules = draft.costEscalations;

  const updateRule = (categoryId: string, updates: Partial<CostEscalationRule>) => {
    patch({
      costEscalations: rules.map((r) =>
        r.categoryId === categoryId ? { ...r, ...updates, ruleBasis: "custom" } : r
      ),
      costEscalationPreset: "custom",
    });
  };

  const initRules = () => {
    patch({ costEscalations: createDefaultCostEscalations() });
  };

  const rentRule = rules.find((r) => r.categoryId === "rent");
  const payrollSample =
    (a.ownerInstructorSalary ?? 0) +
    (a.additionalInstructorSalary ?? 0) +
    (a.cleanerSalary ?? 0) +
    (a.receptionSalary ?? 0);

  return (
    <>
      <p className="mb-4 text-xs text-[#6B6560]">
        Most costs will not stay exactly the same as the studio matures. Increase different
        categories at different rates — not one inflation number for everything.
      </p>
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[#6B6560]">Planning preset</span>
          {PRESETS.map((preset) => (
            <Button
              key={preset}
              type="button"
              size="sm"
              variant={draft.costEscalationPreset === preset ? "default" : "outline"}
              onClick={() =>
                patch({
                  costEscalationPreset: preset,
                  costEscalations:
                    rules.length > 0 ? rules : createDefaultCostEscalations(),
                })
              }
            >
              {preset === "low"
                ? "Low cost growth"
                : preset === "base"
                  ? "Base case"
                  : preset === "high"
                    ? "High cost growth"
                    : "Custom"}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DraftNumberField
            field="forecastYears"
            label="Forecast years"
            integer
            min={1}
            max={10}
            inputClassName="w-20"
          />
          <span className="text-xs text-[#A39E98]">Operating years (months 1–12, 13–24, …)</span>
        </div>
      </div>

      {rules.length === 0 ? (
        <Button type="button" size="sm" onClick={initRules}>
          Load planning defaults
        </Button>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#E8E2D9] text-xs text-[#A39E98]">
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Current value</th>
                <th className="py-2 pr-4">Escalation</th>
                <th className="py-2 pr-4">First month</th>
                <th className="py-2">Basis</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.categoryId} className="border-b border-[#E8E2D9]/60">
                  <td className="py-2 pr-4 font-medium text-[#2C2825]">
                    {rule.label}
                    {rule.contractActive && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        Contract rule active
                      </Badge>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-[#6B6560]">
                    {rule.categoryId === "payroll"
                      ? formatINR(payrollSample) + "/mo"
                      : rule.categoryId === "rent"
                        ? formatINR(a.rent) + "/mo"
                        : "—"}
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <CrudSelect
                        value={rule.escalationType}
                        options={["annual_pct", "step_pct_interval", "fixed_amount", "none"]}
                        onChange={(escalationType) =>
                          updateRule(rule.categoryId, {
                            escalationType: escalationType as CostEscalationRule["escalationType"],
                          })
                        }
                        aria-label={`${rule.label} escalation type`}
                      />
                      {rule.escalationType === "annual_pct" && (
                        <>
                          <DraftInlineNumber
                            value={rule.annualPct ?? 0}
                            onChange={(v) => updateRule(rule.categoryId, { annualPct: v })}
                            className="w-16"
                          />
                          <span className="text-xs text-[#A39E98]">%/yr</span>
                        </>
                      )}
                      {rule.escalationType === "step_pct_interval" && (
                        <>
                          <DraftInlineNumber
                            value={rule.stepPct ?? 0}
                            onChange={(v) => updateRule(rule.categoryId, { stepPct: v })}
                            className="w-16"
                          />
                          <span className="text-xs text-[#A39E98]">% every</span>
                          <DraftInlineNumber
                            value={rule.stepIntervalMonths ?? 12}
                            onChange={(v) =>
                              updateRule(rule.categoryId, { stepIntervalMonths: v })
                            }
                            className="w-16"
                            integer
                          />
                          <span className="text-xs text-[#A39E98]">mo</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-4">
                    <DraftInlineNumber
                      value={rule.firstEscalationMonth}
                      onChange={(v) => updateRule(rule.categoryId, { firstEscalationMonth: v })}
                      className="w-16"
                      integer
                    />
                  </td>
                  <td className="py-2 text-xs text-[#A39E98]">
                    {rule.contractActive
                      ? "Actual / contract"
                      : rule.ruleBasis === "planning_default"
                        ? "Planning default"
                        : "Custom"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rentRule?.contractActive === false && rentRule.escalationType === "annual_pct" && (
        <p className="mt-3 text-xs text-[#A39E98]">
          Rent escalation: use the actual escalation clause in your lease when known. The planning
          percentage is only a placeholder.
        </p>
      )}

      <div className="mt-6 border-t border-[#E8E2D9] pt-4">
        <h4 className="text-sm font-medium text-[#2C2825]">Price growth</h4>
        <p className="mt-1 text-xs text-[#A39E98]">
          Customer prices do not automatically rise when your costs rise. Set annual price increase
          only if you plan to raise pricing.
        </p>
        <div className="mt-3 space-y-2">
          {a.products
            .filter((p) => p.lifecycle !== "archived")
            .slice(0, 8)
            .map((product) => {
              const growth = draft.productPriceGrowth.find((g) => g.productId === product.id);
              const pct = growth?.annualIncreasePct ?? 0;
              return (
                <div key={product.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-[120px] text-[#6B6560]">{product.name}</span>
                  <DraftInlineNumber
                    value={pct}
                    onChange={(v) => {
                      const existing = draft.productPriceGrowth.filter(
                        (g) => g.productId !== product.id
                      );
                      patch({
                        productPriceGrowth: [
                          ...existing,
                          {
                            productId: product.id,
                            annualIncreasePct: v,
                            firstIncreaseMonth: growth?.firstIncreaseMonth ?? 13,
                          },
                        ],
                      });
                    }}
                    className="w-16"
                  />
                  <span className="text-xs text-[#A39E98]">% annual (net ex-GST)</span>
                </div>
              );
            })}
        </div>
      </div>
    </>
  );
}

export function AnnualEscalationSection({
  searchQuery = "",
}: {
  searchQuery?: string;
}) {
  const { state, updateAssumptions } = useApp();
  const forecast = resolveForecastSettings(state.assumptions);

  const committed: EscalationDraft = {
    forecastYears: forecast.forecastYears,
    costEscalationPreset: forecast.costEscalationPreset,
    costEscalations: forecast.costEscalations,
    productPriceGrowth: forecast.productPriceGrowth,
  };

  return (
    <AssumptionSection
      title="Annual escalation"
      searchQuery={searchQuery}
      searchKeywords={[
        "forecast years",
        "cost growth",
        "price growth",
        "rent escalation",
        "payroll",
        "private instructor",
      ]}
      committed={committed}
      onSave={(draft) =>
        updateAssumptions({
          forecastSettings: {
            ...forecast,
            ...draft,
          },
        })
      }
    >
      <EscalationSectionBody />
    </AssumptionSection>
  );
}
