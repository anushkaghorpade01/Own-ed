import Decimal from "decimal.js";
import { d, sum } from "./decimal";
import type { DirectCostsResult, OperatingExpensesResult } from "./engine/costs";
import type { FinanceAssumptions } from "./schemas";
import type { RevenueResult } from "./engine/revenue";
import type { PLResult } from "./engine/pl";

export type PLBreakdownLine = { label: string; value: Decimal };

function sumCustomExpenses(
  assumptions: FinanceAssumptions,
  category: "fixed" | "variable"
): Decimal {
  return sum(
    (assumptions.customExpenses ?? [])
      .filter((e) => e.category === category)
      .map((e) => d(e.amount))
  );
}

export function getNetSalesBreakdown(
  revenue: RevenueResult,
  pl: PLResult
): PLBreakdownLine[] {
  return [
    { label: "Group classes (flexible credit)", value: revenue.groupClassRevenue },
    { label: "Standing Spot", value: revenue.standingSpotRevenue },
    { label: "Private training", value: revenue.privateRevenue },
    { label: "Duo sessions", value: revenue.duoRevenue },
    { label: "Workshops", value: revenue.workshopRevenue },
    ...(revenue.standbyRevenue.gt(0)
      ? [{ label: "Standby", value: revenue.standbyRevenue }]
      : []),
    ...(revenue.otherRevenue.gt(0)
      ? [{ label: "Other revenue", value: revenue.otherRevenue }]
      : []),
    { label: "Gross customer billings", value: pl.grossCustomerBillings },
    { label: "Less: GST collected", value: pl.gstCollected.negated() },
  ];
}

export function getDirectCostBreakdown(
  directCosts: DirectCostsResult,
  assumptions: FinanceAssumptions
): PLBreakdownLine[] {
  const customVariable = sumCustomExpenses(assumptions, "variable");
  const lines: PLBreakdownLine[] = [];

  if (directCosts.variableInstructorPayouts.gt(0)) {
    lines.push({
      label: "Instructor delivery",
      value: directCosts.variableInstructorPayouts,
    });
  }

  lines.push(
    { label: "Session consumables", value: directCosts.sessionConsumables },
    { label: "Payment processing", value: directCosts.paymentFees }
  );

  if (customVariable.gt(0)) {
    lines.push({ label: "Custom variable expenses", value: customVariable });
  }
  if (directCosts.directWorkshopCosts.gt(0)) {
    lines.push({ label: "Workshop direct costs", value: directCosts.directWorkshopCosts });
  }

  return lines;
}

export function getOperatingExpenseBreakdown(
  operatingExpenses: OperatingExpensesResult,
  assumptions: FinanceAssumptions
): PLBreakdownLine[] {
  const lines: PLBreakdownLine[] = [
    { label: "Rent", value: operatingExpenses.rent },
    { label: "CAM / maintenance", value: operatingExpenses.camMaintenance },
    { label: "Utilities", value: operatingExpenses.utilities },
    { label: "Owner instructor salary", value: operatingExpenses.ownerSalary },
    { label: "Additional instructor salary", value: operatingExpenses.instructorSalaries },
    { label: "Cleaner salary", value: operatingExpenses.cleanerSalary },
    { label: "Reception salary", value: operatingExpenses.receptionSalary },
    { label: "Security", value: operatingExpenses.security },
    { label: "Internet", value: operatingExpenses.internet },
    { label: "Software subscriptions", value: operatingExpenses.softwareSubscriptions },
    { label: "Accounting", value: operatingExpenses.accounting },
    { label: "Insurance", value: operatingExpenses.insurance },
    { label: "Marketing", value: operatingExpenses.marketing },
    { label: "Licences", value: operatingExpenses.licences },
    { label: "Other fixed costs", value: operatingExpenses.otherFixed },
    { label: "Laundry", value: operatingExpenses.laundry },
    { label: "Water", value: operatingExpenses.water },
    { label: "Cleaning supplies", value: operatingExpenses.cleaningSupplies },
    { label: "Refreshments", value: operatingExpenses.refreshments },
    { label: "Customer acquisition", value: operatingExpenses.customerAcquisition },
    { label: "Repairs reserve", value: operatingExpenses.repairsReserve },
    { label: "Misc variable costs", value: operatingExpenses.miscVariable },
  ];

  for (const expense of (assumptions.customExpenses ?? []).filter((e) => e.category === "fixed")) {
    lines.push({ label: expense.name || "Custom fixed expense", value: d(expense.amount) });
  }

  return lines.filter((line) => line.value.abs().gt(0));
}

export function getDepreciationBreakdown(assumptions: FinanceAssumptions): PLBreakdownLine[] {
  return assumptions.depreciationAssets.map((asset) => {
    const depreciable = d(asset.purchaseValue).minus(asset.salvageValue);
    const monthly =
      asset.usefulLifeMonths <= 0
        ? new Decimal(0)
        : depreciable.dividedBy(asset.usefulLifeMonths);
    return { label: asset.name, value: monthly };
  });
}
