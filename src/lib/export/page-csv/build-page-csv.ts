import Decimal from "decimal.js";
import { runFinanceModel } from "@/lib/finance/run-model";
import {
  getDepreciationBreakdown,
  getDirectCostBreakdown,
  getNetSalesBreakdown,
  getOperatingExpenseBreakdown,
} from "@/lib/finance/pl-breakdown";
import {
  runSalesTargetAnalysis,
  evaluateSalesPlan,
  getCoreSalesProducts,
  buildServiceDemandMixPct,
} from "@/lib/finance/engine/sales-client-target";
import { getSalesPlanProductLabel } from "@/lib/finance/sales-plan-labels";
import { compareScenarios } from "@/lib/finance/engine/scenarios";
import type { ScenarioDetailMetrics } from "@/lib/finance/engine/scenarios";
import { analyzeFlexiblePack, resolvePackRules } from "@/lib/finance/engine/flexible-packs";
import { productNetPrice } from "@/lib/finance/engine/product-pricing";
import {
  listBaseCaseMixProducts,
  getServiceDemandPct,
} from "@/lib/finance/engine/service-demand-mix";
import { OPERATING_CASH_INFLOW_BASIS } from "@/lib/finance/cash-basis";
import {
  CAPEX_FIELDS,
  FINANCING_FIELDS,
  TAX_FIELDS,
} from "@/lib/finance/assumption-fields";
import type { PageCsvBuildInput, PageCsvExport, PageCsvRoute } from "./types";

function n(value: Decimal | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : null;
  const x = value.toNumber();
  return Number.isFinite(x) ? Math.round(x) : null;
}

function pct(value: Decimal | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const x = value.toNumber();
  return Number.isFinite(x) ? Math.round(x * 10) / 10 : null;
}

function makeExport(
  pathname: string,
  pageTitle: string,
  headers: string[],
  rows: (string | number | null)[][]
): PageCsvExport {
  return { pathname, pageTitle, headers, rows };
}

const SCENARIO_COMPARISON_ROWS: Array<{
  label: string;
  key: keyof ScenarioDetailMetrics;
}> = [
  { label: "Reformers", key: "reformers" },
  { label: "Occupancy %", key: "occupancyPct" },
  { label: "Planning net sales", key: "earnedNetRevenue" },
  { label: "EBITDA", key: "ebitda" },
  { label: "Net profit", key: "netProfit" },
  { label: "Break-even occupancy %", key: "breakEvenOccupancyPct" },
  { label: "Payback month", key: "paybackMonth" },
  { label: "Capacity utilisation %", key: "utilisationPct" },
];

function scenarioCell(key: keyof ScenarioDetailMetrics, v: unknown): string | number | null {
  if (v instanceof Decimal) {
    if (key.includes("Pct") || key === "utilisationPct" || key === "breakEvenOccupancyPct") {
      return pct(v);
    }
    return n(v);
  }
  if (v === null || v === undefined) return "N/A";
  return v as string | number;
}

const ROUTES: PageCsvRoute[] = [
  {
    test: (p) => p === "/math/sales-target",
    pageTitle: "Sales_Client_Target",
    build: ({ assumptions }) => {
      const analysis = runSalesTargetAnalysis(assumptions);
      const prefs = analysis.preferences;
      const products = getCoreSalesProducts(assumptions);
      const planQty =
        prefs.customSalesQuantitiesByProductId ??
        Object.fromEntries(products.map((pr) => [pr.id, 0]));
      const plan = evaluateSalesPlan(
        assumptions,
        planQty,
        prefs.targetMonth,
        prefs.targetMonthlyNetProfit
      );
      const forecastQty = analysis.forecastSalesByProduct;

      const headers = ["Metric", "Forecast", "Your plan"];
      const rows: (string | number | null)[][] = products.map((p) => [
        getSalesPlanProductLabel(p),
        forecastQty[p.id] ?? 0,
        planQty[p.id] ?? 0,
      ]);
      rows.push(["Net sales", n(analysis.suggestedMix.netSales), n(plan.netSales)]);
      rows.push(["Planning net profit", n(analysis.forecastProfit), n(plan.planningNetProfit)]);
      rows.push(["Credits created", null, n(plan.delivery.creditsSold)]);
      rows.push(["Expected delivery demand", null, n(plan.delivery.totalReformerDemand)]);
      rows.push(["Capacity status", null, plan.delivery.capacityStatus]);

      return makeExport("/math/sales-target", "Sales_Client_Target", headers, rows);
    },
  },
  {
    test: (p) => p === "/math/cash-flow",
    pageTitle: "Cash_Flow",
    build: ({ assumptions }) => {
      const model = runFinanceModel(assumptions);
      const headers = [
        "Month",
        "Occupancy %",
        OPERATING_CASH_INFLOW_BASIS.columnLabel,
        "Outflows",
        "Net operating cash",
        "Recovery position",
        "Bank cash",
      ];
      const rows = model.cashFlow.monthly.map((m) => [
        m.month,
        pct(m.occupancyPct),
        n(m.cashInflows),
        n(m.cashOutflows),
        n(m.netOperatingCashFlow),
        n(m.recoveryPosition),
        n(m.bankCashBalance),
      ]);
      return makeExport("/math/cash-flow", "Cash_Flow", headers, rows);
    },
  },
  {
    test: (p) => p === "/math/pl",
    pageTitle: "Profit_and_Loss",
    build: ({ assumptions }) => {
      const model = runFinanceModel(assumptions);
      const pl = model.pl;
      const netSales = getNetSalesBreakdown(model.revenue, pl);
      const direct = getDirectCostBreakdown(model.directCosts, assumptions);
      const opex = getOperatingExpenseBreakdown(model.operatingExpenses, assumptions);
      const depr = getDepreciationBreakdown(assumptions);

      const headers = ["Line item", "Amount (INR)"];
      const rows: (string | number | null)[][] = [
        ["--- NET SALES ---", null],
        ...netSales.map((l) => [l.label, n(l.value)]),
        ["Total net sales", n(pl.netRevenue)],
        ["--- DIRECT COSTS ---", null],
        ...direct.map((l) => [l.label, n(l.value)]),
        ["Total direct costs", n(pl.directCosts)],
        ["Gross profit", n(pl.grossProfit)],
        ["--- OPERATING EXPENSES ---", null],
        ...opex.map((l) => [l.label, n(l.value)]),
        ["Total operating expenses", n(pl.operatingExpenses)],
        ["EBITDA", n(pl.ebitda)],
        ["Depreciation", n(pl.depreciation)],
        ...depr.map((l) => [`  ${l.label}`, n(l.value)]),
        ["Interest", n(pl.interestExpense)],
        ["Tax", n(pl.incomeTax)],
        ["Planning net profit", n(pl.netProfit)],
      ];
      return makeExport("/math/pl", "Profit_and_Loss", headers, rows);
    },
  },
  {
    test: (p) => p === "/math/unit-economics",
    pageTitle: "Unit_Economics",
    build: ({ assumptions }) => {
      const model = runFinanceModel(assumptions);
      const headers = [
        "Occupancy",
        "Capacity",
        "Net sales",
        "Direct costs",
        "Contribution (CM1)",
        "Fully loaded profit",
      ];
      const rows = model.unitEconomics.perClass.map((c) => [
        c.occupancy,
        c.capacity,
        n(c.netRevenue),
        n(c.directVariableCosts.plus(c.instructorVariableCost)),
        n(c.contributionMargin),
        n(c.fullyLoadedProfit),
      ]);
      return makeExport("/math/unit-economics", "Unit_Economics", headers, rows);
    },
  },
  {
    test: (p) => p === "/math/capacity",
    pageTitle: "Capacity",
    build: ({ assumptions }) => {
      const model = runFinanceModel(assumptions);
      const cap = model.capacity;
      const uc = model.unusedCapacity;
      const cl = model.creditLiability;
      const headers = ["Metric", "Value"];
      const rows: (string | number | null)[][] = [
        ["Reformers", assumptions.reformers],
        ["Weekly classes", n(cap.weeklyClasses)],
        ["Monthly available reformer spots", n(cap.monthlyAvailableSeats)],
        ["Occupied spots (monthly)", n(cap.occupiedSeatsMonthly)],
        ["Attended seats (monthly)", n(cap.attendedSeatsMonthly)],
        ["Target occupancy %", assumptions.projectedBookedOccupancyPct],
        ["Total physical capacity", n(uc.totalPhysicalCapacity)],
        ["Expected occupied capacity", n(uc.expectedOccupiedCapacity)],
        ["Unused capacity", n(uc.unusedCapacity)],
        ["Credits sold outstanding", assumptions.creditsSoldOutstanding],
        ["Expected redemption before expiry", assumptions.creditsExpectedRedemptionBeforeExpiry],
        ["Credit coverage ratio (eligible)", pct(cl.eligibleCoverageRatio)],
      ];
      return makeExport("/math/capacity", "Capacity", headers, rows);
    },
  },
  {
    test: (p) => p === "/math/break-even",
    pageTitle: "Break_Even",
    build: ({ assumptions }) => {
      const model = runFinanceModel(assumptions);
      const be = model.breakEven;
      const headers = ["Metric", "Value"];
      const rows: (string | number | null)[][] = [
        ["Contribution break-even occupancy %", pct(be.contributionBreakEven.breakEvenOccupancyPct)],
        ["Required occupied seats/month", n(be.contributionBreakEven.requiredOccupiedSeats)],
        ["EBITDA break-even occupancy %", pct(be.ebitdaBreakEvenOccupancyPct)],
        ["Operating cash break-even month", be.cashBreakEvenMonth ?? "Not reached"],
        ["Current EBITDA at planned occupancy", n(model.pl.ebitda)],
        ["Planned occupancy %", assumptions.projectedBookedOccupancyPct],
      ];
      return makeExport("/math/break-even", "Break_Even", headers, rows);
    },
  },
  {
    test: (p) => p === "/math/payback",
    pageTitle: "Investment_Recovery",
    build: ({ assumptions }) => {
      const model = runFinanceModel(assumptions);
      const pb = model.payback;
      const headers = [
        "Month",
        "Cumulative operating cash generated",
        "Investment hurdle",
        "Recovery position",
      ];
      const hurdle = n(model.cashFlow.launch.paybackInvestmentBase);
      const rows: (string | number | null)[][] = [
        [
          "Summary: Payback month",
          pb.paybackMonth ?? "Not reached",
          "Investment to recover",
          n(pb.initialInvestment),
        ],
        ...model.cashFlow.monthly.map((m) => [
          m.month,
          n(m.cumulativeOperatingCashGenerated),
          hurdle,
          n(m.recoveryPosition),
        ]),
      ];
      return makeExport("/math/payback", "Investment_Recovery", headers, rows);
    },
  },
  {
    test: (p) => p === "/math/scenarios",
    pageTitle: "Scenario_Comparison",
    build: ({ assumptions, scenarios = [] }) => {
      const active = scenarios.filter((s) => !s.archived);
      if (active.length === 0) {
        return makeExport("/math/scenarios", "Scenario_Comparison", ["Note"], [
          ["No saved scenarios to export"],
        ]);
      }
      const compared = compareScenarios(
        assumptions,
        active.map((s) => s.assumptions)
      );
      const names = active.map((s) => s.name);
      const headers = ["Metric", ...names];
      const rows = SCENARIO_COMPARISON_ROWS.map(({ label, key }) => [
        label,
        ...compared.map((c) => scenarioCell(key, c.metrics[key])),
      ]);
      return makeExport("/math/scenarios", "Scenario_Comparison", headers, rows);
    },
  },
  {
    test: (p) => p === "/math/assumptions",
    pageTitle: "Assumptions",
    build: ({ assumptions }) => {
      const headers = ["Category", "Assumption", "Value", "Unit"];
      const rows: (string | number | null)[][] = [];
      const push = (cat: string, name: string, val: unknown, unit: string) => {
        if (val == null || val === "") return;
        rows.push([cat, name, val as string | number, unit]);
      };

      push("Studio", "Reformers", assumptions.reformers, "count");
      push("Studio", "Operating days/week", assumptions.operatingDaysPerWeek, "days");
      push("Occupancy", "Target booked occupancy", assumptions.projectedBookedOccupancyPct, "%");
      push("Operating", "Rent", assumptions.rent, "INR/month");
      push("Operating", "Owner instructor salary", assumptions.ownerInstructorSalary, "INR/month");
      push("Financing", "Founder funding planned", assumptions.founderEquity, "INR");
      push("Financing", "Loan principal", assumptions.loanAmount, "INR");

      for (const f of CAPEX_FIELDS) {
        const val = (assumptions as Record<string, unknown>)[f.key];
        if (typeof val === "number" && val !== 0) push("Capex", f.label, val, "INR");
      }
      for (const f of FINANCING_FIELDS) {
        const val = (assumptions as Record<string, unknown>)[f.key];
        if (val != null && val !== "" && val !== 0) push("Financing", f.label, val, f.suffix ?? "");
      }
      for (const f of TAX_FIELDS) {
        const val = (assumptions as Record<string, unknown>)[f.key];
        if (val != null) push("Tax", f.label, val, f.suffix ?? "");
      }

      return makeExport("/math/assumptions", "Assumptions", headers, rows);
    },
  },
  {
    test: (p) => p === "/math/pricing",
    pageTitle: "Products_Pricing",
    build: ({ assumptions }) => {
      const headers = [
        "Product",
        "Type",
        "Credits",
        "Net price ex GST",
        "Customer price",
        "GST treatment",
      ];
      const rows = assumptions.products
        .filter((p) => p.lifecycle !== "archived")
        .map((p) => [
          p.name,
          p.type,
          p.creditsIncluded || (p.type === "private" ? 1 : 0),
          n(productNetPrice(p, assumptions)),
          p.price,
          p.gstFollowsGlobal ? `Global ${assumptions.gstRatePct}%` : p.gstTreatment,
        ]);
      return makeExport("/math/pricing", "Products_Pricing", headers, rows);
    },
  },
  {
    test: (p) => p === "/math/access-products/mix",
    pageTitle: "Service_Demand_Mix",
    build: ({ assumptions }) => {
      const products = listBaseCaseMixProducts(assumptions);
      const mixPct = buildServiceDemandMixPct(assumptions);
      const headers = ["Service", "Booking mix %"];
      const rows = products.map((p) => [p.name, Math.round(mixPct[p.id] ?? getServiceDemandPct(p))]);
      return makeExport("/math/access-products/mix", "Service_Demand_Mix", headers, rows);
    },
  },
  {
    test: (p) => p.startsWith("/math/access-products/flexible"),
    pageTitle: "Flexible_Products",
    build: ({ assumptions }) => {
      const packs = assumptions.products.filter(
        (p) => (p.type === "credit_pack" || p.type === "drop_in") && p.lifecycle !== "archived"
      );
      const headers = [
        "Product",
        "Credits",
        "Validity",
        "Net package value",
        "Expected contribution",
        "Expected sales/month",
      ];
      const rows = packs.map((p) => {
        const econ = analyzeFlexiblePack(p, assumptions);
        const rules = resolvePackRules(p);
        return [
          p.name,
          p.creditsIncluded || 1,
          `${rules.validityValue} ${rules.validityUnit}`,
          n(econ.netPackageValue),
          n(econ.expectedContribution),
          rules.expectedSalesVolumePerMonth ?? 0,
        ];
      });
      return makeExport("/math/access-products/flexible", "Flexible_Products", headers, rows);
    },
  },
  {
    test: (p) => p === "/math",
    pageTitle: "Math_Overview",
    build: ({ assumptions }) => {
      const model = runFinanceModel(assumptions);
      const wr = model.revenue.weightedRevenue;
      const be = model.breakEven.contributionBreakEven;
      const headers = ["Metric", "Value"];
      const summaryRows: (string | number | null)[][] = [
        ["Break-even occupancy %", pct(be.breakEvenOccupancyPct)],
        ["Occupied seats / month", n(model.capacity.occupiedSeatsMonthly)],
        ["Planning net sales", n(model.revenue.netRevenue)],
        ["Monthly available seats", n(model.capacity.monthlyAvailableSeats)],
        ["Gross profit", n(model.pl.grossProfit)],
        ["EBITDA", n(model.pl.ebitda)],
        ["Planning net profit", n(model.pl.netProfit)],
      ];
      const mixRows: (string | number | null)[][] = wr.serviceBookingBreakdown.map((r) => [
        r.product.name,
        n(r.weightedNetSalesImpact),
      ]);
      return makeExport("/math", "Math_Overview", headers, [
        ...summaryRows,
        ["--- Weighted net sales by service ---", null],
        ...mixRows,
      ]);
    },
  },
  {
    test: (p) => p === "/math/schedule",
    pageTitle: "Schedule",
    build: ({ assumptions }) => {
      const headers = [
        "Day",
        "Start time",
        "Duration (min)",
        "Class type",
        "Capacity",
        "Peak/off-peak",
        "Instructor",
        "Status",
      ];
      const rows = assumptions.schedule.map((s) => [
        s.day,
        s.startTime,
        s.durationMinutes,
        s.classType,
        s.capacity,
        s.peakOffPeak,
        s.instructor ?? "",
        s.status,
      ]);
      return makeExport("/math/schedule", "Schedule", headers, rows);
    },
  },
];

export function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function getPageCsvRoute(pathname: string): PageCsvRoute | undefined {
  const normalized = normalizePathname(pathname);
  return ROUTES.find((r) => r.test(normalized));
}

export function pageCsvExportSupported(pathname: string): boolean {
  return getPageCsvRoute(pathname) != null;
}

export function getPageCsvPageTitle(pathname: string): string | null {
  return getPageCsvRoute(pathname)?.pageTitle ?? null;
}

export function buildPageCsvExport(
  pathname: string,
  input: PageCsvBuildInput
): PageCsvExport | null {
  const route = getPageCsvRoute(pathname);
  if (!route) return null;
  return route.build(input);
}

export const PAGE_CSV_SUPPORTED_PATHS = ROUTES.map((r) => r.pageTitle);
