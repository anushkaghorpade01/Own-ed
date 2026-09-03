"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/store/app-store";
import { SectionHeader } from "@/components/shared/metric-card";
import { FundingPlanEditor } from "@/components/finance/funding-plan-editor";
import { SetupCompleteness } from "@/components/setup/setup-completeness";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BusinessInsightCard } from "@/components/shared/metric-card";
import { explainGstMode } from "@/lib/finance/business-insights";
import { formatINR } from "@/lib/format/currency";
import { runFinanceModel } from "@/lib/finance";
import {
  AssumptionSection,
  DraftCheckboxField,
  DraftCustomExpenseRow,
  DraftDateField,
  DraftDepreciationAssetRow,
  DraftNumberField,
  pickNumericFields,
  useSectionContext,
  type CustomExpenseDraft,
  type DepreciationAssetDraft,
} from "@/components/finance/assumption-section";
import {
  AssumptionsSearchBar,
  sectionMatchesSearch,
} from "@/components/finance/assumptions-search";
import {
  CAPEX_FIELDS,
  FINANCING_FIELDS,
  DEPOSIT_FIELDS,
  ANCILLARY_REVENUE_FIELDS,
  TAX_FIELDS,
  CREDIT_LIABILITY_FIELDS,
} from "@/lib/finance/assumption-fields";
import { OCCUPANCY_FIELD_TOOLTIPS } from "@/lib/finance/occupancy-tooltips";
import { bookedToAttendedYield } from "@/lib/finance/engine/attended-occupancy";
import { format } from "date-fns";
import type { CustomExpense } from "@/lib/finance/schemas";
import { AnnualEscalationSection } from "@/components/finance/annual-escalation-section";
import { ForecastTimelineSection } from "@/components/finance/forecast-timeline-section";

const FIXED_FIELDS: Array<{ key: string; label: string; help?: string }> = [
  { key: "rent", label: "Rent" },
  { key: "camMaintenance", label: "CAM / maintenance" },
  {
    key: "ownerInstructorSalary",
    label: "Owner instructor salary",
    help: "Fixed monthly teaching pay. Salaried instructor cost belongs here — this model does not use per-class fees.",
  },
  {
    key: "additionalInstructorSalary",
    label: "Additional instructor salary",
    help: "Fixed monthly pay for other salaried instructors.",
  },
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

const VARIABLE_FIELDS: Array<{ key: string; label: string; suffix?: string; help?: string }> = [
  { key: "electricityBase", label: "Electricity (base)", suffix: "₹/mo" },
  { key: "electricityVariablePerClass", label: "Electricity per class", suffix: "₹" },
  { key: "laundry", label: "Laundry", suffix: "₹/mo" },
  { key: "water", label: "Water", suffix: "₹/mo" },
  { key: "cleaningSupplies", label: "Cleaning supplies", suffix: "₹/mo" },
  { key: "sessionConsumables", label: "Session consumables", suffix: "₹/seat" },
  { key: "refreshments", label: "Refreshments", suffix: "₹/mo" },
  { key: "paymentGatewayPct", label: "Payment gateway", suffix: "%" },
  { key: "paymentGatewayFixedFee", label: "Payment gateway fixed fee", suffix: "₹/txn" },
  { key: "customerAcquisitionSpend", label: "Customer acquisition", suffix: "₹/mo" },
  { key: "repairsReserve", label: "Repairs reserve", suffix: "₹/mo" },
  { key: "miscVariableCosts", label: "Misc variable", suffix: "₹/mo" },
];

const STUDIO_KEYS = [
  "reformers",
  "maxGroupClassSize",
  "operatingDaysPerWeek",
  "classesPerDay",
  "weeksClosedPerYear",
] as const;

const OCCUPANCY_KEYS = [
  "projectedBookedOccupancyPct",
  "projectedAttendedOccupancyPct",
  "peakOccupancyPct",
  "offPeakOccupancyPct",
  "cancellationRatePct",
  "noShowRatePct",
] as const;

const PACK_PRESALE_KEYS = ["rampPackSalesMultiplierCap"] as const;

const RAMP_KEYS = [
  "rampUpStartingOccupancyPct",
  "rampUpTargetOccupancyPct",
  "rampUpMonthsToTarget",
] as const;

const LAUNCH_TIMELINE_KEYS = ["preOpeningMonths"] as const;

function fieldLabels(fields: Array<{ label: string }>): string[] {
  return fields.map((f) => f.label);
}

const SEARCH_INDEX = [
  { title: "General", keywords: ["GST", "GST registered", "pricing convention"] },
  { title: "Studio", keywords: ["Reformers", "Max group class size", "Operating days/week", "Classes per day", "Weeks closed/year"] },
  { title: "Occupancy / Demand", keywords: ["Booked occupancy", "Attended occupancy", "Peak occupancy", "Off-peak occupancy", "cancellation", "no-show"] },
  { title: "Pack pre-sales (ramp)", keywords: ["pack pre-sale", "aggressive pre-sale", "ramp pack", "expected sales volume"] },
  { title: "Fixed operating expenses", keywords: [...fieldLabels(FIXED_FIELDS), "owner compensation", "custom fixed"] },
  { title: "Variable expenses", keywords: [...fieldLabels(VARIABLE_FIELDS), "custom variable"] },
  { title: "Launch timeline", keywords: ["pre-opening", "fit-out", "interiors", "lease", "before open", "rent before revenue"] },
  { title: "Ramp-up", keywords: ["Starting occupancy", "Target occupancy", "Months to target"] },
  { title: "Setup investment (capex)", keywords: [...fieldLabels(CAPEX_FIELDS), "launch investment", "working capital"] },
  { title: "Deposits", keywords: [...fieldLabels(DEPOSIT_FIELDS), "recoverable deposit"] },
  { title: "Financing", keywords: [...fieldLabels(FINANCING_FIELDS), "founder equity", "loan"] },
  { title: "Depreciation & tax", keywords: [...fieldLabels(TAX_FIELDS), "depreciation assets"] },
  { title: "Private, duo & other revenue", keywords: fieldLabels(ANCILLARY_REVENUE_FIELDS) },
  { title: "Credit liability (planning)", keywords: fieldLabels(CREDIT_LIABILITY_FIELDS) },
  { title: "Forecast structural changes", keywords: ["reformers", "classes per day", "standing spot", "standby", "structural change"] },
  { title: "Annual escalation", keywords: ["forecast years", "cost growth", "price growth", "rent escalation", "payroll"] },
  { title: "Opening date", keywords: ["target opening date", "opening"] },
];

function toCustomDraft(expenses: CustomExpense[]): CustomExpenseDraft[] {
  return expenses.map((e) => ({ id: e.id, name: e.name, amount: e.amount }));
}

function mergeCustomExpenses(
  existing: CustomExpense[],
  category: "fixed" | "variable",
  draft: CustomExpenseDraft[]
): CustomExpense[] {
  return [
    ...existing.filter((e) => e.category !== category),
    ...draft.map((e) => ({ ...e, category })),
  ];
}

export default function AssumptionsPage() {
  const { state, updateAssumptions } = useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const a = state.assumptions;
  const model = useMemo(() => runFinanceModel(a), [a]);
  const gstInsight = explainGstMode("exclusive", a.gstRatePct, 1695);
  const capex = model.capex;
  const launchInvestment = model.summary.launchInvestment;

  const customFixed = (a.customExpenses ?? []).filter((e) => e.category === "fixed");
  const customVariable = (a.customExpenses ?? []).filter((e) => e.category === "variable");

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

  const removeCustomExpense = (id: string) => {
    updateAssumptions({
      customExpenses: (a.customExpenses ?? []).filter((e) => e.id !== id),
    });
  };

  const depreciationDraft: DepreciationAssetDraft[] = (a.depreciationAssets ?? []).map(
    (asset) => ({
      id: asset.id,
      name: asset.name,
      purchaseValue: asset.purchaseValue,
      usefulLifeMonths: asset.usefulLifeMonths,
      salvageValue: asset.salvageValue,
    })
  );

  const searchResultCount = useMemo(
    () =>
      SEARCH_INDEX.filter((section) =>
        sectionMatchesSearch(section.title, section.keywords, searchQuery)
      ).length,
    [searchQuery]
  );

  const sectionSearch = { searchQuery };

  return (
    <div>
      <SectionHeader
        title="Assumptions"
        description="Edit values in each section, then click Save changes on that section. Totals update immediately after you save."
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

      <AssumptionsSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        resultCount={searchResultCount}
      />

      <div className="space-y-4">
        <AssumptionSection
          title="General"
          defaultOpen
          searchKeywords={SEARCH_INDEX.find((s) => s.title === "General")!.keywords}
          {...sectionSearch}
          committed={{
            gstRatePct: a.gstRatePct,
            gstRegistered: a.gstRegistered,
          }}
          onSave={(draft) =>
            updateAssumptions({
              gstRatePct: draft.gstRatePct,
              gstRegistered: draft.gstRegistered,
            })
          }
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DraftNumberField field="gstRatePct" label="GST rate" suffix="%" />
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#6B6560]">Pricing convention</label>
              <p className="text-sm text-[#2C2825]">Net sales ex-GST (canonical)</p>
              <p className="text-[10px] text-[#A39E98]">
                Enter net prices on products. Customer pays = net × (1 + GST rate).
              </p>
            </div>
            <DraftCheckboxField
              field="gstRegistered"
              id="gst-reg"
              label="GST registered"
            />
          </div>
        </AssumptionSection>

        <AssumptionSection
          title="Studio"
          defaultOpen
          searchKeywords={SEARCH_INDEX.find((s) => s.title === "Studio")!.keywords}
          {...sectionSearch}
          committed={pickNumericFields(a, [...STUDIO_KEYS])}
          onSave={(draft) => updateAssumptions(draft)}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DraftNumberField field="reformers" label="Reformers" integer />
            <DraftNumberField field="maxGroupClassSize" label="Max group class size" integer />
            <DraftNumberField field="operatingDaysPerWeek" label="Operating days/week" integer />
            <DraftNumberField
              field="classesPerDay"
              label="Classes per day (fallback)"
              help="Used when schedule not defined"
              integer
            />
            <DraftNumberField field="weeksClosedPerYear" label="Weeks closed/year" integer />
          </div>
        </AssumptionSection>

        <AssumptionSection
          title="Occupancy / Demand"
          searchKeywords={SEARCH_INDEX.find((s) => s.title === "Occupancy / Demand")!.keywords}
          {...sectionSearch}
          committed={{
            ...pickNumericFields(a, [...OCCUPANCY_KEYS]),
            attendedOccupancyMode: a.attendedOccupancyMode ?? "linked",
          }}
          onSave={(draft) => {
            const linked = draft.attendedOccupancyMode !== "manual";
            const attended = linked
              ? Math.min(
                  draft.projectedBookedOccupancyPct,
                  draft.projectedBookedOccupancyPct *
                    (1 - draft.cancellationRatePct / 100) *
                    (1 - draft.noShowRatePct / 100)
                )
              : Math.min(
                  draft.projectedBookedOccupancyPct,
                  draft.projectedAttendedOccupancyPct
                );
            updateAssumptions({
              ...draft,
              projectedAttendedOccupancyPct: attended,
              rampUpTargetOccupancyPct: draft.projectedBookedOccupancyPct,
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DraftNumberField
              field="projectedBookedOccupancyPct"
              label="Booked occupancy"
              suffix="%"
              tooltip={OCCUPANCY_FIELD_TOOLTIPS.booked}
            />
            <DraftNumberField
              field="projectedAttendedOccupancyPct"
              label="Attended occupancy (target)"
              suffix="%"
              tooltip={OCCUPANCY_FIELD_TOOLTIPS.attended}
            />
            <DraftNumberField
              field="cancellationRatePct"
              label="Cancellation rate"
              suffix="%"
              help="Used when attended follows booked"
            />
            <DraftNumberField
              field="noShowRatePct"
              label="No-show rate"
              suffix="%"
              help="Used when attended follows booked"
            />
            <DraftNumberField
              field="peakOccupancyPct"
              label="Peak occupancy"
              suffix="%"
              tooltip={OCCUPANCY_FIELD_TOOLTIPS.peak}
            />
            <DraftNumberField field="offPeakOccupancyPct" label="Off-peak occupancy" suffix="%" />
          </div>
          <AttendedOccupancyMode />
        </AssumptionSection>

        <AssumptionSection
          title="Fixed operating expenses"
          defaultOpen
          searchKeywords={SEARCH_INDEX.find((s) => s.title === "Fixed operating expenses")!.keywords}
          {...sectionSearch}
          committed={{
            ...pickNumericFields(
              a,
              FIXED_FIELDS.map((f) => f.key)
            ),
            includeOwnerMarketRateComp: a.includeOwnerMarketRateComp,
            customFixed: toCustomDraft(customFixed),
          }}
          onSave={(draft) => {
            const { customFixed: draftCustom, includeOwnerMarketRateComp, ...rest } = draft;
            updateAssumptions({
              ...rest,
              includeOwnerMarketRateComp,
              customExpenses: mergeCustomExpenses(
                a.customExpenses ?? [],
                "fixed",
                draftCustom
              ),
            });
          }}
          extraAction={
            <Button variant="outline" size="sm" onClick={() => addCustomExpense("fixed")}>
              + Add expense
            </Button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FIXED_FIELDS.map(({ key, label, help }) => (
              <DraftNumberField key={key} field={key} label={label} suffix="₹/mo" help={help} />
            ))}
            <DraftCheckboxField
              field="includeOwnerMarketRateComp"
              id="owner-comp"
              label="Include market-rate compensation for owner teaching (recommended — shows true business cost)"
            />
          </div>
          {customFixed.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-[#F0EBE3] pt-4">
              <p className="text-xs font-medium text-[#A39E98]">Custom fixed expenses</p>
              {customFixed.map((exp) => (
                <div key={exp.id} className="flex flex-wrap items-end gap-2">
                  <DraftCustomExpenseRow field="customFixed" expenseId={exp.id} />
                  <Button variant="ghost" size="sm" onClick={() => removeCustomExpense(exp.id)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </AssumptionSection>

        <AssumptionSection
          title="Variable expenses"
          searchKeywords={SEARCH_INDEX.find((s) => s.title === "Variable expenses")!.keywords}
          {...sectionSearch}
          committed={{
            ...pickNumericFields(
              a,
              VARIABLE_FIELDS.map((f) => f.key)
            ),
            customVariable: toCustomDraft(customVariable),
          }}
          onSave={(draft) => {
            const { customVariable: draftCustom, ...rest } = draft;
            updateAssumptions({
              ...rest,
              customExpenses: mergeCustomExpenses(
                a.customExpenses ?? [],
                "variable",
                draftCustom
              ),
            });
          }}
          extraAction={
            <Button variant="outline" size="sm" onClick={() => addCustomExpense("variable")}>
              + Add expense
            </Button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {VARIABLE_FIELDS.map(({ key, label, suffix, help }) => (
              <DraftNumberField
                key={key}
                field={key}
                label={label}
                suffix={suffix ?? "₹/mo"}
                help={help}
              />
            ))}
          </div>
          {customVariable.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-[#F0EBE3] pt-4">
              <p className="text-xs font-medium text-[#A39E98]">Custom variable expenses</p>
              {customVariable.map((exp) => (
                <div key={exp.id} className="flex flex-wrap items-end gap-2">
                  <DraftCustomExpenseRow field="customVariable" expenseId={exp.id} />
                  <Button variant="ghost" size="sm" onClick={() => removeCustomExpense(exp.id)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </AssumptionSection>

        <AssumptionSection
          title="Launch timeline"
          searchKeywords={SEARCH_INDEX.find((s) => s.title === "Launch timeline")!.keywords}
          {...sectionSearch}
          committed={{
            ...pickNumericFields(a, [...LAUNCH_TIMELINE_KEYS]),
            preOpeningOpexMode: a.preOpeningOpexMode ?? "minimal",
          }}
          onSave={(draft) => updateAssumptions(draft)}
        >
          <p className="mb-4 text-xs text-[#6B6560]">
            Months after lease / funding when you pay rent but are not yet running classes
            (interiors, approvals, setup). Interior fit-out cash is spread across these months;
            equipment and other setup capex is paid in the first operating month. Ramp-up starts
            after pre-opening ends.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DraftNumberField
              field="preOpeningMonths"
              label="Pre-opening months"
              integer
              min={0}
              max={24}
              help="0 = open for classes from forecast month 1 (legacy behaviour)"
            />
          </div>
          <LaunchTimelineOpexMode />
        </AssumptionSection>

        <AssumptionSection
          title="Ramp-up"
          searchKeywords={SEARCH_INDEX.find((s) => s.title === "Ramp-up")!.keywords}
          {...sectionSearch}
          committed={pickNumericFields(a, [...RAMP_KEYS])}
          onSave={(draft) =>
            updateAssumptions({
              ...draft,
              projectedBookedOccupancyPct: draft.rampUpTargetOccupancyPct,
            })
          }
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DraftNumberField
              field="rampUpStartingOccupancyPct"
              label="Starting occupancy"
              suffix="%"
              help="First month of classes — ramp begins after pre-opening months"
            />
            <DraftNumberField
              field="rampUpTargetOccupancyPct"
              label="Target occupancy"
              suffix="%"
              help="Ramp endpoint — kept in sync with booked occupancy"
            />
            <DraftNumberField field="rampUpMonthsToTarget" label="Months to target" integer />
          </div>
        </AssumptionSection>

        <AssumptionSection
          title="Pack pre-sales (ramp)"
          searchKeywords={SEARCH_INDEX.find((s) => s.title === "Pack pre-sales (ramp)")!.keywords}
          {...sectionSearch}
          committed={{
            ...pickNumericFields(a, [...PACK_PRESALE_KEYS]),
            rampPackSalesMode: a.rampPackSalesMode ?? "aggressive_presale",
          }}
          onSave={(draft) => updateAssumptions(draft)}
        >
          <p className="mb-4 text-xs text-[#6B6560]">
            P&amp;L and cash count pack revenue at purchase (Access Products → expected monthly
            pack sales). During ramp, aggressive pre-sale scales pack volume up when booked
            occupancy is below target — matching a push to sell packs while the studio is still
            filling. Per-pack volumes are edited under Access Products.
          </p>
          <PackPresaleMode />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DraftNumberField
              field="rampPackSalesMultiplierCap"
              label="Pre-sale multiplier cap"
              integer
              min={1}
              max={10}
              help="Max × boost when below target occupancy (e.g. 3 = up to 3× steady pack volume)"
            />
          </div>
        </AssumptionSection>

        <AssumptionSection
          title="Setup investment (capex)"
          defaultOpen
          searchKeywords={SEARCH_INDEX.find((s) => s.title === "Setup investment (capex)")!.keywords}
          {...sectionSearch}
          committed={{
            ...pickNumericFields(
              a,
              CAPEX_FIELDS.map((f) => f.key)
            ),
            workingCapital: a.workingCapital,
          }}
          onSave={(draft) => updateAssumptions(draft)}
        >
          <p className="mb-4 text-xs text-[#6B6560]">
            One-off setup costs — not monthly opex. These drive{" "}
            <strong>Launch investment</strong> on the home dashboard and payback hurdle.
            Capex is not expensed through the monthly P&amp;L (depreciation is separate).
            Working capital is a cash buffer funded at launch and retained in the bank — counted
            once in launch investment, not as a separate expense.
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
              <DraftNumberField key={key} field={key} label={label} suffix="₹" />
            ))}
            <DraftNumberField
              field="workingCapital"
              label="Working capital (opening cash buffer)"
              suffix="₹"
              help="Funded at launch and kept in the bank — included in launch investment, not spent as opex"
            />
          </div>
        </AssumptionSection>

        <AssumptionSection
          title="Deposits"
          searchKeywords={SEARCH_INDEX.find((s) => s.title === "Deposits")!.keywords}
          {...sectionSearch}
          committed={{
            ...pickNumericFields(
              a,
              DEPOSIT_FIELDS.map((f) => f.key)
            ),
            includeRecoverableDepositInPayback: a.includeRecoverableDepositInPayback,
          }}
          onSave={(draft) => {
            const { includeRecoverableDepositInPayback, ...rest } = draft;
            updateAssumptions({ ...rest, includeRecoverableDepositInPayback });
          }}
        >
          <p className="mb-4 text-xs text-[#6B6560]">
            Refundable security deposit is balance-sheet cash, not an operating expense.
            Excluded from payback hurdle unless you enable the toggle below.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DEPOSIT_FIELDS.map(({ key, label, suffix }) => (
              <DraftNumberField
                key={key}
                field={key}
                label={label}
                suffix={suffix ?? "₹"}
              />
            ))}
            <DraftCheckboxField
              field="includeRecoverableDepositInPayback"
              id="deposit-payback"
              label="Include recoverable deposit in payback hurdle"
            />
          </div>
        </AssumptionSection>

        <AssumptionSection
          title="Financing"
          searchKeywords={SEARCH_INDEX.find((s) => s.title === "Financing")!.keywords}
          {...sectionSearch}
          committed={pickNumericFields(
            a,
            FINANCING_FIELDS.map((f) => f.key)
          )}
          onSave={(draft) => updateAssumptions(draft)}
        >
          <p className="mb-4 text-xs text-[#6B6560]">
            Enter how much cash you plan to put in. This is your decision — the model will show
            whether it is enough for bank liquidity but will never change it automatically. Loan
            funding is separate and affects bank cash only, not investment recovery or payback.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FINANCING_FIELDS.map(({ key, label, suffix }) => (
              <DraftNumberField
                key={key}
                field={key}
                label={label}
                suffix={suffix ?? "₹"}
              />
            ))}
          </div>
          <div className="mt-6 border-t border-[#F0EBE3] pt-4">
            <FundingPlanEditor />
          </div>
        </AssumptionSection>

        <AssumptionSection
          title="Depreciation & tax"
          searchKeywords={SEARCH_INDEX.find((s) => s.title === "Depreciation & tax")!.keywords}
          {...sectionSearch}
          committed={{
            ...pickNumericFields(
              a,
              TAX_FIELDS.map((f) => f.key)
            ),
            depreciationAssets: depreciationDraft,
          }}
          onSave={(draft) => {
            const { depreciationAssets, ...rest } = draft;
            updateAssumptions({
              ...rest,
              depreciationAssets: depreciationAssets
                .map((asset) => {
                  const existing = a.depreciationAssets.find((x) => x.id === asset.id);
                  if (!existing) return null;
                  return {
                    ...existing,
                    purchaseValue: asset.purchaseValue,
                    usefulLifeMonths: asset.usefulLifeMonths,
                    salvageValue: asset.salvageValue,
                  };
                })
                .filter((asset): asset is NonNullable<typeof asset> => asset != null),
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TAX_FIELDS.map(({ key, label, suffix, help }) => (
              <DraftNumberField
                key={key}
                field={key}
                label={label}
                suffix={suffix ?? "%"}
                help={help}
              />
            ))}
          </div>
          {depreciationDraft.length > 0 && (
            <div className="mt-4 space-y-3 border-t border-[#F0EBE3] pt-4">
              <p className="text-xs font-medium text-[#A39E98]">Depreciation assets</p>
              {depreciationDraft.map((asset) => (
                <DraftDepreciationAssetRow
                  key={asset.id}
                  field="depreciationAssets"
                  assetId={asset.id}
                  monthlyDepreciationLabel={
                    <>Monthly depreciation (all assets): {formatINR(model.pl.depreciation)}</>
                  }
                />
              ))}
            </div>
          )}
        </AssumptionSection>

        <AssumptionSection
          title="Private, duo & other revenue"
          searchKeywords={
            SEARCH_INDEX.find((s) => s.title === "Private, duo & other revenue")!.keywords
          }
          {...sectionSearch}
          committed={pickNumericFields(
            a,
            ANCILLARY_REVENUE_FIELDS.map((f) => f.key)
          )}
          onSave={(draft) => updateAssumptions(draft)}
        >
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
              <DraftNumberField
                key={key}
                field={key}
                label={label}
                suffix={suffix ?? "₹"}
              />
            ))}
          </div>
        </AssumptionSection>

        <AssumptionSection
          title="Credit liability (planning)"
          searchKeywords={
            SEARCH_INDEX.find((s) => s.title === "Credit liability (planning)")!.keywords
          }
          {...sectionSearch}
          committed={pickNumericFields(
            a,
            CREDIT_LIABILITY_FIELDS.map((f) => f.key)
          )}
          onSave={(draft) => updateAssumptions(draft)}
        >
          <p className="mb-4 text-xs text-[#6B6560]">
            Outstanding credit obligations vs capacity — used on Capacity and Credit Health pages.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CREDIT_LIABILITY_FIELDS.map(({ key, label, suffix }) => (
              <DraftNumberField
                key={key}
                field={key}
                label={label}
                suffix={suffix ?? ""}
              />
            ))}
          </div>
        </AssumptionSection>

        <ForecastTimelineSection {...sectionSearch} />

        <AnnualEscalationSection {...sectionSearch} />

        <AssumptionSection
          title="Opening date"
          searchKeywords={SEARCH_INDEX.find((s) => s.title === "Opening date")!.keywords}
          {...sectionSearch}
          committed={{ targetOpeningDate: a.targetOpeningDate ?? "" }}
          onSave={(draft) => updateAssumptions({ targetOpeningDate: draft.targetOpeningDate })}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DraftDateField field="targetOpeningDate" label="Target opening date" />
          </div>
        </AssumptionSection>
      </div>
    </div>
  );
}

type OccupancyDraft = {
  projectedBookedOccupancyPct: number;
  projectedAttendedOccupancyPct: number;
  cancellationRatePct: number;
  noShowRatePct: number;
  attendedOccupancyMode: "linked" | "manual";
};

function AttendedOccupancyMode() {
  const { draft, patch } = useSectionContext<OccupancyDraft>();
  const linked = draft.attendedOccupancyMode !== "manual";
  const implied = Math.min(
    draft.projectedBookedOccupancyPct,
    draft.projectedBookedOccupancyPct * bookedToAttendedYield(draft as OccupancyDraft & { attendedOccupancyMode: "linked" })
  );

  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-medium text-[#6B6560]">Attended occupancy</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={linked ? "default" : "outline"}
          onClick={() =>
            patch({
              attendedOccupancyMode: "linked",
              projectedAttendedOccupancyPct: implied,
            })
          }
        >
          Follows booked (cancel / no-show)
        </Button>
        <Button
          type="button"
          size="sm"
          variant={!linked ? "default" : "outline"}
          onClick={() => patch({ attendedOccupancyMode: "manual" })}
        >
          Manual override
        </Button>
      </div>
      {linked ? (
        <p className="mt-2 text-xs text-[#A39E98]">
          At {draft.projectedBookedOccupancyPct}% booked → ~{implied.toFixed(1)}% attended
          (scales the same way during ramp months). Delivery costs use attended; revenue uses
          booked.
        </p>
      ) : (
        <p className="mt-2 text-xs text-[#A39E98]">
          Attended is capped at booked occupancy. Must not exceed booked seats.
        </p>
      )}
    </div>
  );
}

type PackPresaleDraft = {
  rampPackSalesMode: "steady" | "aggressive_presale";
  rampPackSalesMultiplierCap: number;
};

function PackPresaleMode() {
  const { draft, patch } = useSectionContext<PackPresaleDraft>();
  const modes: Array<{ id: PackPresaleDraft["rampPackSalesMode"]; label: string }> = [
    { id: "aggressive_presale", label: "Aggressive pre-sale below target" },
    { id: "steady", label: "Steady pack volume every month" },
  ];

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-[#6B6560]">Ramp pack sales</p>
      <div className="flex flex-wrap gap-2">
        {modes.map(({ id, label }) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={draft.rampPackSalesMode === id ? "default" : "outline"}
            onClick={() => patch({ rampPackSalesMode: id })}
          >
            {label}
          </Button>
        ))}
      </div>
      {draft.rampPackSalesMode === "aggressive_presale" ? (
        <p className="mt-2 text-xs text-[#A39E98]">
          When booked occupancy is below target, pack sales scale up (target ÷ current, capped) so
          you can model selling more packs while the studio is quiet. Credit Health warns if new
          credits exceed open capacity.
        </p>
      ) : null}
    </div>
  );
}

type LaunchTimelineDraft = {
  preOpeningMonths: number;
  preOpeningOpexMode: "minimal" | "full";
};

function LaunchTimelineOpexMode() {
  const { draft, patch } = useSectionContext<LaunchTimelineDraft>();
  const modes: Array<{ id: LaunchTimelineDraft["preOpeningOpexMode"]; label: string }> = [
    { id: "minimal", label: "Minimal (rent + CAM + base power)" },
    { id: "full", label: "Full operating expenses" },
  ];

  if ((draft.preOpeningMonths ?? 0) === 0) {
    return (
      <p className="mt-3 text-xs text-[#A39E98]">
        Pre-opening opex applies only when pre-opening months is greater than zero.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-medium text-[#6B6560]">Pre-opening operating costs</p>
      <div className="flex flex-wrap gap-2">
        {modes.map(({ id, label }) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={draft.preOpeningOpexMode === id ? "default" : "outline"}
            onClick={() => patch({ preOpeningOpexMode: id })}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
