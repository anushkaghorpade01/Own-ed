"use client";

import { useApp } from "@/lib/store/app-store";
import { SectionHeader, SampleBanner, CollapsibleSection } from "@/components/shared/metric-card";
import { ModelUpdatingIndicator } from "@/components/finance/model-updating-indicator";
import { FundingPlanEditor } from "@/components/finance/funding-plan-editor";
import { SetupCompleteness } from "@/components/setup/setup-completeness";
import { Input } from "@/components/ui/input";
import { DebouncedNumberInput, DebouncedTextInput } from "@/components/ui/debounced-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BusinessInsightCard } from "@/components/shared/metric-card";
import { explainGstMode } from "@/lib/finance/business-insights";
import { formatINR } from "@/lib/format/currency";
import { useFinanceModel } from "@/hooks/use-finance-model";
import {
  CAPEX_FIELDS,
  FINANCING_FIELDS,
  DEPOSIT_FIELDS,
  ANCILLARY_REVENUE_FIELDS,
  TAX_FIELDS,
  CREDIT_LIABILITY_FIELDS,
} from "@/lib/finance/assumption-fields";
import { format } from "date-fns";
import type { CustomExpense } from "@/lib/finance/schemas";
import { AnnualEscalationSection } from "@/components/finance/annual-escalation-section";
import { ForecastTimelineSection } from "@/components/finance/forecast-timeline-section";

const FIXED_FIELDS: Array<{ key: string; label: string }> = [
  { key: "rent", label: "Rent" },
  { key: "camMaintenance", label: "CAM / maintenance" },
  { key: "ownerInstructorSalary", label: "Owner instructor salary" },
  { key: "additionalInstructorSalary", label: "Additional instructor salary" },
  { key: "cleanerSalary", label: "Cleaner salary" },
  { key: "receptionSalary", label: "Reception salary" },
  { key: "security", label: "Security" },
  { key: "internet", label: "Internet" },
  { key: "softwareSubscriptions", label: "Software subscriptions" },
  { key: "accounting", label: "Accounting" },
  { key: "insurance", label: "Insurance" },
  { key: "fixedMarketingRetainer", label: "Fixed marketing retainer" },
  { key: "licences", label: "Licences" },
  { key: "otherFixedCosts", label: "Other fixed costs" },
];

const VARIABLE_FIELDS: Array<{ key: string; label: string; suffix?: string }> = [
  { key: "electricityBase", label: "Electricity (base)", suffix: "₹/mo" },
  { key: "electricityVariablePerClass", label: "Electricity per class", suffix: "₹" },
  { key: "laundry", label: "Laundry", suffix: "₹/mo" },
  { key: "water", label: "Water", suffix: "₹/mo" },
  { key: "cleaningSupplies", label: "Cleaning supplies", suffix: "₹/mo" },
  { key: "sessionConsumables", label: "Session consumables", suffix: "₹/seat" },
  { key: "refreshments", label: "Refreshments", suffix: "₹/mo" },
  { key: "paymentGatewayPct", label: "Payment gateway", suffix: "%" },
  { key: "paymentGatewayFixedFee", label: "Payment gateway fixed fee", suffix: "₹/txn" },
  { key: "instructorPerClassPayout", label: "Instructor per-class payout", suffix: "₹" },
  { key: "instructorPerAttendeePayout", label: "Instructor per-attendee", suffix: "₹" },
  { key: "customerAcquisitionSpend", label: "Customer acquisition", suffix: "₹/mo" },
  { key: "repairsReserve", label: "Repairs reserve", suffix: "₹/mo" },
  { key: "miscVariableCosts", label: "Misc variable", suffix: "₹/mo" },
];

function AssumptionField({
  label,
  value,
  onChange,
  suffix,
  help,
}: {
  label: string;
  value: string | number;
  onChange: (v: number) => void;
  suffix?: string;
  help?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-[#6B6560]">{label}</label>
      <div className="flex items-center gap-2">
        <DebouncedNumberInput
          value={value}
          onCommit={onChange}
          className="max-w-[200px]"
        />
        {suffix && <span className="text-xs text-[#A39E98]">{suffix}</span>}
      </div>
      {help && <p className="text-[10px] text-[#A39E98]">{help}</p>}
    </div>
  );
}

export default function AssumptionsPage() {
  const { state, updateAssumptions } = useApp();
  const a = state.assumptions;
  const model = useFinanceModel();
  const gstInsight = explainGstMode("exclusive", a.gstRatePct, 1695);
  const capex = model.capex;
  const launchInvestment = model.summary.launchInvestment;

  const addCustomExpense = (category: "fixed" | "variable") => {
    const expense: CustomExpense = {
      id: `exp-${Date.now()}`,
      name: "New expense",
      amount: 0,
      category,
    };
    updateAssumptions({
      customExpenses: [...(a.customExpenses ?? []), expense],
    });
  };

  const updateCustomExpense = (id: string, updates: Partial<CustomExpense>) => {
    updateAssumptions({
      customExpenses: (a.customExpenses ?? []).map((e) =>
        e.id === id ? { ...e, ...updates } : e
      ),
    });
  };

  const removeCustomExpense = (id: string) => {
    updateAssumptions({
      customExpenses: (a.customExpenses ?? []).filter((e) => e.id !== id),
    });
  };

  const customFixed = (a.customExpenses ?? []).filter((e) => e.category === "fixed");
  const customVariable = (a.customExpenses ?? []).filter((e) => e.category === "variable");

  return (
    <div>
      <SectionHeader
        title="Assumptions"
        description="Central assumptions database — all financial calculations derive from here. Changes update every Math page instantly."
        action={
          <div className="flex items-center gap-3">
            <ModelUpdatingIndicator />
            <Badge variant="secondary">
              Last edited {format(new Date(a.updatedAt), "d MMM yyyy, HH:mm")}
            </Badge>
          </div>
        }
      />
      <SetupCompleteness />

      <div className="mb-6">
        <BusinessInsightCard {...gstInsight} />
      </div>

      <div className="space-y-4">
        <CollapsibleSection title="General" defaultOpen>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AssumptionField label="GST rate" value={a.gstRatePct} onChange={(v) => updateAssumptions({ gstRatePct: v })} suffix="%" />
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#6B6560]">Pricing convention</label>
              <p className="text-sm text-[#2C2825]">Net sales ex-GST (canonical)</p>
              <p className="text-[10px] text-[#A39E98]">
                Enter net prices on products. Customer pays = net × (1 + GST rate).
              </p>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                checked={a.gstRegistered}
                onChange={(e) => updateAssumptions({ gstRegistered: e.target.checked })}
                id="gst-reg"
              />
              <label htmlFor="gst-reg" className="text-xs text-[#6B6560]">GST registered</label>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Studio" defaultOpen>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AssumptionField label="Reformers" value={a.reformers} onChange={(v) => updateAssumptions({ reformers: v })} />
            <AssumptionField label="Max group class size" value={a.maxGroupClassSize} onChange={(v) => updateAssumptions({ maxGroupClassSize: v })} />
            <AssumptionField label="Operating days/week" value={a.operatingDaysPerWeek} onChange={(v) => updateAssumptions({ operatingDaysPerWeek: v })} />
            <AssumptionField label="Classes per day (fallback)" value={a.classesPerDay} onChange={(v) => updateAssumptions({ classesPerDay: v })} help="Used when schedule not defined" />
            <AssumptionField label="Weeks closed/year" value={a.weeksClosedPerYear} onChange={(v) => updateAssumptions({ weeksClosedPerYear: v })} />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Occupancy / Demand">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AssumptionField label="Booked occupancy" value={a.projectedBookedOccupancyPct} onChange={(v) => updateAssumptions({ projectedBookedOccupancyPct: v, rampUpTargetOccupancyPct: v })} suffix="%" help="What % of available spots get booked — also the ramp-up endpoint for payback" />
            <AssumptionField label="Attended occupancy" value={a.projectedAttendedOccupancyPct} onChange={(v) => updateAssumptions({ projectedAttendedOccupancyPct: v })} suffix="%" help="After cancellations and no-shows" />
            <AssumptionField label="Peak occupancy" value={a.peakOccupancyPct} onChange={(v) => updateAssumptions({ peakOccupancyPct: v })} suffix="%" />
            <AssumptionField label="Off-peak occupancy" value={a.offPeakOccupancyPct} onChange={(v) => updateAssumptions({ offPeakOccupancyPct: v })} suffix="%" />
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Fixed operating expenses"
          defaultOpen
          action={
            <Button variant="outline" size="sm" onClick={() => addCustomExpense("fixed")}>
              + Add expense
            </Button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FIXED_FIELDS.map(({ key, label }) => (
              <AssumptionField
                key={key}
                label={label}
                value={Number(a[key as keyof typeof a] ?? 0)}
                onChange={(v) => updateAssumptions({ [key]: v })}
                suffix="₹/mo"
              />
            ))}
            <div className="flex items-center gap-2 pt-4 sm:col-span-2">
              <input
                type="checkbox"
                checked={a.includeOwnerMarketRateComp}
                onChange={(e) => updateAssumptions({ includeOwnerMarketRateComp: e.target.checked })}
                id="owner-comp"
              />
              <label htmlFor="owner-comp" className="text-xs text-[#6B6560]">
                Include market-rate compensation for owner teaching (recommended — shows true business cost)
              </label>
            </div>
          </div>
          {customFixed.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-[#F0EBE3] pt-4">
              <p className="text-xs font-medium text-[#A39E98]">Custom fixed expenses</p>
              {customFixed.map((exp) => (
                <div key={exp.id} className="flex flex-wrap items-center gap-2">
                  <DebouncedTextInput
                    value={exp.name}
                    onCommit={(name) => updateCustomExpense(exp.id, { name })}
                    className="max-w-[180px]"
                    placeholder="Expense name"
                  />
                  <DebouncedNumberInput
                    value={exp.amount}
                    onCommit={(amount) => updateCustomExpense(exp.id, { amount })}
                    className="max-w-[120px]"
                  />
                  <span className="text-xs text-[#A39E98]">₹/mo</span>
                  <Button variant="ghost" size="sm" onClick={() => removeCustomExpense(exp.id)}>Remove</Button>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="Variable expenses"
          action={
            <Button variant="outline" size="sm" onClick={() => addCustomExpense("variable")}>
              + Add expense
            </Button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {VARIABLE_FIELDS.map(({ key, label, suffix }) => (
              <AssumptionField
                key={key}
                label={label}
                value={Number(a[key as keyof typeof a] ?? 0)}
                onChange={(v) => updateAssumptions({ [key]: v })}
                suffix={suffix ?? "₹/mo"}
              />
            ))}
          </div>
          {customVariable.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-[#F0EBE3] pt-4">
              <p className="text-xs font-medium text-[#A39E98]">Custom variable expenses</p>
              {customVariable.map((exp) => (
                <div key={exp.id} className="flex flex-wrap items-center gap-2">
                  <Input
                    value={exp.name}
                    onChange={(e) => updateCustomExpense(exp.id, { name: e.target.value })}
                    className="max-w-[180px]"
                  />
                  <Input
                    type="number"
                    value={exp.amount}
                    onChange={(e) => updateCustomExpense(exp.id, { amount: parseFloat(e.target.value) || 0 })}
                    className="max-w-[120px]"
                  />
                  <span className="text-xs text-[#A39E98]">₹/mo</span>
                  <Button variant="ghost" size="sm" onClick={() => removeCustomExpense(exp.id)}>Remove</Button>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="Ramp-up">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AssumptionField label="Starting occupancy" value={a.rampUpStartingOccupancyPct} onChange={(v) => updateAssumptions({ rampUpStartingOccupancyPct: v })} suffix="%" help="Month 1 occupancy — studio won't be full on day one" />
            <AssumptionField label="Target occupancy" value={a.rampUpTargetOccupancyPct} onChange={(v) => updateAssumptions({ rampUpTargetOccupancyPct: v, projectedBookedOccupancyPct: v })} suffix="%" help="Ramp endpoint — kept in sync with booked occupancy" />
            <AssumptionField label="Months to target" value={a.rampUpMonthsToTarget} onChange={(v) => updateAssumptions({ rampUpMonthsToTarget: v })} />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Setup investment (capex)" defaultOpen>
          <p className="mb-4 text-xs text-[#6B6560]">
            One-off setup costs — not monthly opex. These drive{" "}
            <strong>Launch investment</strong> on the home dashboard and payback hurdle.
            Capex is not expensed through the monthly P&amp;L (depreciation is separate).
          </p>
          <div className="mb-4 grid gap-3 rounded-lg bg-[#FAF8F5] p-4 sm:grid-cols-3 text-sm">
            <div>
              <p className="text-xs text-[#A39E98]">Non-recoverable capex</p>
              <p className="text-kpi-secondary">{formatINR(capex.nonRecoverableCapex)}</p>
            </div>
            <div>
              <p className="text-xs text-[#A39E98]">Working capital</p>
              <p className="text-kpi-secondary">{formatINR(a.workingCapital)}</p>
            </div>
            <div>
              <p className="text-xs text-[#A39E98]">Launch investment (payback hurdle)</p>
              <p className="text-kpi-secondary">{formatINR(launchInvestment)}</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAPEX_FIELDS.map(({ key, label }) => (
              <AssumptionField
                key={key}
                label={label}
                value={Number(a[key as keyof typeof a] ?? 0)}
                onChange={(v) => updateAssumptions({ [key]: v })}
                suffix="₹"
              />
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Deposits">
          <p className="mb-4 text-xs text-[#6B6560]">
            Refundable security deposit is balance-sheet cash, not an operating expense.
            Excluded from payback hurdle unless you enable the toggle below.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DEPOSIT_FIELDS.map(({ key, label, suffix }) => (
              <AssumptionField
                key={key}
                label={label}
                value={Number(a[key as keyof typeof a] ?? 0)}
                onChange={(v) => updateAssumptions({ [key]: v })}
                suffix={suffix ?? "₹"}
              />
            ))}
            <div className="flex items-center gap-2 pt-4 sm:col-span-2">
              <input
                type="checkbox"
                checked={a.includeRecoverableDepositInPayback}
                onChange={(e) =>
                  updateAssumptions({ includeRecoverableDepositInPayback: e.target.checked })
                }
                id="deposit-payback"
              />
              <label htmlFor="deposit-payback" className="text-xs text-[#6B6560]">
                Include recoverable deposit in payback hurdle
              </label>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Financing">
          <p className="mb-4 text-xs text-[#6B6560]">
            Founder equity is your <strong>planning total</strong> for all cash you&apos;ll put in
            — your own money plus friends &amp; family for now. Stake and revenue-share splits come
            later. Loan funding is separate and affects bank cash only, not investment recovery.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FINANCING_FIELDS.map(({ key, label, suffix }) => (
              <AssumptionField
                key={key}
                label={label}
                value={Number(a[key as keyof typeof a] ?? 0)}
                onChange={(v) => updateAssumptions({ [key]: v })}
                suffix={suffix ?? "₹"}
              />
            ))}
          </div>
          <div className="mt-6 border-t border-[#F0EBE3] pt-4">
            <FundingPlanEditor />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Depreciation & tax">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TAX_FIELDS.map(({ key, label, suffix }) => (
              <AssumptionField
                key={key}
                label={label}
                value={Number(a[key as keyof typeof a] ?? 0)}
                onChange={(v) => updateAssumptions({ [key]: v })}
                suffix={suffix ?? "%"}
              />
            ))}
          </div>
          {(a.depreciationAssets ?? []).length > 0 && (
            <div className="mt-4 space-y-3 border-t border-[#F0EBE3] pt-4">
              <p className="text-xs font-medium text-[#A39E98]">Depreciation assets</p>
              {a.depreciationAssets.map((asset, idx) => (
                <div key={asset.id} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <AssumptionField
                    label={`${asset.name} — purchase value`}
                    value={asset.purchaseValue}
                    onChange={(v) => {
                      const assets = [...a.depreciationAssets];
                      assets[idx] = { ...asset, purchaseValue: v };
                      updateAssumptions({ depreciationAssets: assets });
                    }}
                    suffix="₹"
                  />
                  <AssumptionField
                    label="Useful life"
                    value={asset.usefulLifeMonths}
                    onChange={(v) => {
                      const assets = [...a.depreciationAssets];
                      assets[idx] = { ...asset, usefulLifeMonths: Math.max(1, Math.round(v)) };
                      updateAssumptions({ depreciationAssets: assets });
                    }}
                    suffix="months"
                  />
                  <AssumptionField
                    label="Salvage value"
                    value={asset.salvageValue}
                    onChange={(v) => {
                      const assets = [...a.depreciationAssets];
                      assets[idx] = { ...asset, salvageValue: v };
                      updateAssumptions({ depreciationAssets: assets });
                    }}
                    suffix="₹"
                  />
                  <div className="flex items-end pb-1 text-xs text-[#6B6560]">
                    Monthly depreciation (all assets): {formatINR(model.pl.depreciation)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="Private, duo & other revenue">
          <p className="mb-4 text-xs text-[#6B6560]">
            Session volume comes from Access Products → Private/Duo session mix (%). Prices here set
            revenue per session. Edit mix on{" "}
            <a href="/math/access-products" className="underline">
              Access Products
            </a>
            .
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ANCILLARY_REVENUE_FIELDS.map(({ key, label, suffix }) => (
              <AssumptionField
                key={key}
                label={label}
                value={Number(a[key as keyof typeof a] ?? 0)}
                onChange={(v) => updateAssumptions({ [key]: v })}
                suffix={suffix ?? "₹"}
              />
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Credit liability (planning)">
          <p className="mb-4 text-xs text-[#6B6560]">
            Outstanding credit obligations vs capacity — used on Capacity and Credit Health pages.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CREDIT_LIABILITY_FIELDS.map(({ key, label, suffix }) => (
              <AssumptionField
                key={key}
                label={label}
                value={Number(a[key as keyof typeof a] ?? 0)}
                onChange={(v) => updateAssumptions({ [key]: v })}
                suffix={suffix ?? ""}
              />
            ))}
          </div>
        </CollapsibleSection>

        <ForecastTimelineSection />

        <AnnualEscalationSection />

        <CollapsibleSection title="Opening date">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#6B6560]">Target opening date</label>
              <Input
                type="date"
                value={a.targetOpeningDate?.slice(0, 10) ?? ""}
                onChange={(e) => updateAssumptions({ targetOpeningDate: e.target.value })}
                className="max-w-[200px]"
              />
            </div>
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
