"use client";

import { useMemo } from "react";
import { useApp } from "@/lib/store/app-store";
import { SectionHeader, SampleBanner, CollapsibleSection } from "@/components/shared/metric-card";
import { FundingPlanEditor } from "@/components/finance/funding-plan-editor";
import { SetupCompleteness } from "@/components/setup/setup-completeness";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BusinessInsightCard } from "@/components/shared/metric-card";
import { explainGstMode } from "@/lib/finance/business-insights";
import { formatINR } from "@/lib/format/currency";
import { runFinanceModel } from "@/lib/finance";
import {
  SaveableAssumptionField,
  SaveableCheckboxAssumptionField,
  SaveableDateAssumptionField,
  SaveableTextAssumptionField,
} from "@/components/finance/saveable-assumption-field";
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

export default function AssumptionsPage() {
  const { state, updateAssumptions } = useApp();
  const a = state.assumptions;
  const model = useMemo(() => runFinanceModel(a), [a]);
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
        description="Central assumptions database — all financial calculations derive from here. Edit a value, click Save, and totals update immediately."
        action={
          <Badge variant="secondary">
            Last edited {format(new Date(a.updatedAt), "d MMM yyyy, HH:mm")}
          </Badge>
        }
      />
      <SetupCompleteness />

      <div className="mb-6">
        <BusinessInsightCard {...gstInsight} />
      </div>

      <div className="space-y-4">
        <CollapsibleSection title="General" defaultOpen>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SaveableAssumptionField label="GST rate" value={a.gstRatePct} onSave={(v) => updateAssumptions({ gstRatePct: v })} suffix="%" />
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#6B6560]">Pricing convention</label>
              <p className="text-sm text-[#2C2825]">Net sales ex-GST (canonical)</p>
              <p className="text-[10px] text-[#A39E98]">
                Enter net prices on products. Customer pays = net × (1 + GST rate).
              </p>
            </div>
            <SaveableCheckboxAssumptionField
              id="gst-reg"
              label="GST registered"
              checked={a.gstRegistered}
              onSave={(gstRegistered) => updateAssumptions({ gstRegistered })}
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Studio" defaultOpen>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SaveableAssumptionField label="Reformers" value={a.reformers} onSave={(v) => updateAssumptions({ reformers: v })} integer />
            <SaveableAssumptionField label="Max group class size" value={a.maxGroupClassSize} onSave={(v) => updateAssumptions({ maxGroupClassSize: v })} integer />
            <SaveableAssumptionField label="Operating days/week" value={a.operatingDaysPerWeek} onSave={(v) => updateAssumptions({ operatingDaysPerWeek: v })} integer />
            <SaveableAssumptionField label="Classes per day (fallback)" value={a.classesPerDay} onSave={(v) => updateAssumptions({ classesPerDay: v })} help="Used when schedule not defined" integer />
            <SaveableAssumptionField label="Weeks closed/year" value={a.weeksClosedPerYear} onSave={(v) => updateAssumptions({ weeksClosedPerYear: v })} integer />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Occupancy / Demand">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SaveableAssumptionField label="Booked occupancy" value={a.projectedBookedOccupancyPct} onSave={(v) => updateAssumptions({ projectedBookedOccupancyPct: v, rampUpTargetOccupancyPct: v })} suffix="%" help="What % of available spots get booked — also the ramp-up endpoint for payback" />
            <SaveableAssumptionField label="Attended occupancy" value={a.projectedAttendedOccupancyPct} onSave={(v) => updateAssumptions({ projectedAttendedOccupancyPct: v })} suffix="%" help="After cancellations and no-shows" />
            <SaveableAssumptionField label="Peak occupancy" value={a.peakOccupancyPct} onSave={(v) => updateAssumptions({ peakOccupancyPct: v })} suffix="%" />
            <SaveableAssumptionField label="Off-peak occupancy" value={a.offPeakOccupancyPct} onSave={(v) => updateAssumptions({ offPeakOccupancyPct: v })} suffix="%" />
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
              <SaveableAssumptionField
                key={key}
                label={label}
                value={Number(a[key as keyof typeof a] ?? 0)}
                onSave={(v) => updateAssumptions({ [key]: v })}
                suffix="₹/mo"
              />
            ))}
            <SaveableCheckboxAssumptionField
              id="owner-comp"
              label="Include market-rate compensation for owner teaching (recommended — shows true business cost)"
              checked={a.includeOwnerMarketRateComp}
              onSave={(includeOwnerMarketRateComp) =>
                updateAssumptions({ includeOwnerMarketRateComp })
              }
            />
          </div>
          {customFixed.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-[#F0EBE3] pt-4">
              <p className="text-xs font-medium text-[#A39E98]">Custom fixed expenses</p>
              {customFixed.map((exp) => (
                <div key={exp.id} className="flex flex-wrap items-end gap-2">
                  <SaveableTextAssumptionField
                    value={exp.name}
                    onSave={(name) => updateCustomExpense(exp.id, { name })}
                    placeholder="Expense name"
                    inputClassName="max-w-[180px]"
                  />
                  <SaveableAssumptionField
                    label=""
                    value={exp.amount}
                    onSave={(amount) => updateCustomExpense(exp.id, { amount })}
                    inputClassName="max-w-[120px]"
                  />
                  <span className="pb-2 text-xs text-[#A39E98]">₹/mo</span>
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
              <SaveableAssumptionField
                key={key}
                label={label}
                value={Number(a[key as keyof typeof a] ?? 0)}
                onSave={(v) => updateAssumptions({ [key]: v })}
                suffix={suffix ?? "₹/mo"}
              />
            ))}
          </div>
          {customVariable.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-[#F0EBE3] pt-4">
              <p className="text-xs font-medium text-[#A39E98]">Custom variable expenses</p>
              {customVariable.map((exp) => (
                <div key={exp.id} className="flex flex-wrap items-end gap-2">
                  <SaveableTextAssumptionField
                    value={exp.name}
                    onSave={(name) => updateCustomExpense(exp.id, { name })}
                    placeholder="Expense name"
                    inputClassName="max-w-[180px]"
                  />
                  <SaveableAssumptionField
                    label=""
                    value={exp.amount}
                    onSave={(amount) => updateCustomExpense(exp.id, { amount })}
                    inputClassName="max-w-[120px]"
                  />
                  <span className="pb-2 text-xs text-[#A39E98]">₹/mo</span>
                  <Button variant="ghost" size="sm" onClick={() => removeCustomExpense(exp.id)}>Remove</Button>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="Ramp-up">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SaveableAssumptionField label="Starting occupancy" value={a.rampUpStartingOccupancyPct} onSave={(v) => updateAssumptions({ rampUpStartingOccupancyPct: v })} suffix="%" help="Month 1 occupancy — studio won't be full on day one" />
            <SaveableAssumptionField label="Target occupancy" value={a.rampUpTargetOccupancyPct} onSave={(v) => updateAssumptions({ rampUpTargetOccupancyPct: v, projectedBookedOccupancyPct: v })} suffix="%" help="Ramp endpoint — kept in sync with booked occupancy" />
            <SaveableAssumptionField label="Months to target" value={a.rampUpMonthsToTarget} onSave={(v) => updateAssumptions({ rampUpMonthsToTarget: v })} />
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
              <SaveableAssumptionField
                key={key}
                label={label}
                value={Number(a[key as keyof typeof a] ?? 0)}
                onSave={(v) => updateAssumptions({ [key]: v })}
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
              <SaveableAssumptionField
                key={key}
                label={label}
                value={Number(a[key as keyof typeof a] ?? 0)}
                onSave={(v) => updateAssumptions({ [key]: v })}
                suffix={suffix ?? "₹"}
              />
            ))}
            <SaveableCheckboxAssumptionField
              id="deposit-payback"
              label="Include recoverable deposit in payback hurdle"
              checked={a.includeRecoverableDepositInPayback}
              onSave={(includeRecoverableDepositInPayback) =>
                updateAssumptions({ includeRecoverableDepositInPayback })
              }
            />
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
              <SaveableAssumptionField
                key={key}
                label={label}
                value={Number(a[key as keyof typeof a] ?? 0)}
                onSave={(v) => updateAssumptions({ [key]: v })}
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
              <SaveableAssumptionField
                key={key}
                label={label}
                value={Number(a[key as keyof typeof a] ?? 0)}
                onSave={(v) => updateAssumptions({ [key]: v })}
                suffix={suffix ?? "%"}
              />
            ))}
          </div>
          {(a.depreciationAssets ?? []).length > 0 && (
            <div className="mt-4 space-y-3 border-t border-[#F0EBE3] pt-4">
              <p className="text-xs font-medium text-[#A39E98]">Depreciation assets</p>
              {a.depreciationAssets.map((asset, idx) => (
                <div key={asset.id} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <SaveableAssumptionField
                    label={`${asset.name} — purchase value`}
                    value={asset.purchaseValue}
                    onSave={(v) => {
                      const assets = [...a.depreciationAssets];
                      assets[idx] = { ...asset, purchaseValue: v };
                      updateAssumptions({ depreciationAssets: assets });
                    }}
                    suffix="₹"
                  />
                  <SaveableAssumptionField
                    label="Useful life"
                    value={asset.usefulLifeMonths}
                    onSave={(v) => {
                      const assets = [...a.depreciationAssets];
                      assets[idx] = { ...asset, usefulLifeMonths: Math.max(1, Math.round(v)) };
                      updateAssumptions({ depreciationAssets: assets });
                    }}
                    suffix="months"
                  />
                  <SaveableAssumptionField
                    label="Salvage value"
                    value={asset.salvageValue}
                    onSave={(v) => {
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
              <SaveableAssumptionField
                key={key}
                label={label}
                value={Number(a[key as keyof typeof a] ?? 0)}
                onSave={(v) => updateAssumptions({ [key]: v })}
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
              <SaveableAssumptionField
                key={key}
                label={label}
                value={Number(a[key as keyof typeof a] ?? 0)}
                onSave={(v) => updateAssumptions({ [key]: v })}
                suffix={suffix ?? ""}
              />
            ))}
          </div>
        </CollapsibleSection>

        <ForecastTimelineSection />

        <AnnualEscalationSection />

        <CollapsibleSection title="Opening date">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SaveableDateAssumptionField
              label="Target opening date"
              value={a.targetOpeningDate ?? ""}
              onSave={(targetOpeningDate) => updateAssumptions({ targetOpeningDate })}
            />
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
