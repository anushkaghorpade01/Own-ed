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
] as const;

const RAMP_KEYS = [
  "rampUpStartingOccupancyPct",
  "rampUpTargetOccupancyPct",
  "rampUpMonthsToTarget",
] as const;

function fieldLabels(fields: Array<{ label: string }>): string[] {
  return fields.map((f) => f.label);
}

const SEARCH_INDEX = [
  { title: "General", keywords: ["GST", "GST registered", "pricing convention"] },
  { title: "Studio", keywords: ["Reformers", "Max group class size", "Operating days/week", "Classes per day", "Weeks closed/year"] },
  { title: "Occupancy / Demand", keywords: ["Booked occupancy", "Attended occupancy", "Peak occupancy", "Off-peak occupancy"] },
  { title: "Fixed operating expenses", keywords: [...fieldLabels(FIXED_FIELDS), "owner compensation", "custom fixed"] },
  { title: "Variable expenses", keywords: [...fieldLabels(VARIABLE_FIELDS), "custom variable"] },
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
          committed={pickNumericFields(a, [...OCCUPANCY_KEYS])}
          onSave={(draft) =>
            updateAssumptions({
              ...draft,
              rampUpTargetOccupancyPct: draft.projectedBookedOccupancyPct,
            })
          }
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DraftNumberField
              field="projectedBookedOccupancyPct"
              label="Booked occupancy"
              suffix="%"
              help="What % of available spots get booked — also the ramp-up endpoint for payback"
            />
            <DraftNumberField
              field="projectedAttendedOccupancyPct"
              label="Attended occupancy"
              suffix="%"
              help="After cancellations and no-shows"
            />
            <DraftNumberField field="peakOccupancyPct" label="Peak occupancy" suffix="%" />
            <DraftNumberField field="offPeakOccupancyPct" label="Off-peak occupancy" suffix="%" />
          </div>
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
            {FIXED_FIELDS.map(({ key, label }) => (
              <DraftNumberField key={key} field={key} label={label} suffix="₹/mo" />
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
            {VARIABLE_FIELDS.map(({ key, label, suffix }) => (
              <DraftNumberField
                key={key}
                field={key}
                label={label}
                suffix={suffix ?? "₹/mo"}
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
              help="Month 1 occupancy — studio won't be full on day one"
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
          title="Setup investment (capex)"
          defaultOpen
          searchKeywords={SEARCH_INDEX.find((s) => s.title === "Setup investment (capex)")!.keywords}
          {...sectionSearch}
          committed={pickNumericFields(
            a,
            CAPEX_FIELDS.map((f) => f.key)
          )}
          onSave={(draft) => updateAssumptions(draft)}
        >
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
              <DraftNumberField key={key} field={key} label={label} suffix="₹" />
            ))}
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
            Founder equity is your <strong>planning total</strong> for all cash you&apos;ll put in
            — your own money plus friends &amp; family for now. Stake and revenue-share splits come
            later. Loan funding is separate and affects bank cash only, not investment recovery.
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
            {TAX_FIELDS.map(({ key, label, suffix }) => (
              <DraftNumberField
                key={key}
                field={key}
                label={label}
                suffix={suffix ?? "%"}
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
