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

const PACK_PRESALE_KEYS = ["rampPackSalesMultiplierCap"] as const;

const RAMP_KEYS = [
  "rampUpStartingOccupancyPct",
  "rampUpTargetOccupancyPct",
