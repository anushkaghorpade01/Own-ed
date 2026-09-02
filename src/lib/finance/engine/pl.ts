import { d, sum, trace, type CalculationTrace } from "../decimal";
import type { FinanceAssumptions } from "../schemas";
import type { RevenueResult } from "./revenue";
import type { DirectCostsResult, OperatingExpensesResult } from "./costs";
import { calculateDepreciation, calculateLoanInterest } from "./costs";
import Decimal from "decimal.js";

export interface PLResult {
  grossBookings: Decimal;
  discounts: Decimal;
  refunds: Decimal;
  grossCustomerBillings: Decimal;
  gstCollected: Decimal;
  netRevenue: Decimal;
  directCosts: Decimal;
  grossProfit: Decimal;
  grossMarginPct: Decimal;
  operatingExpenses: Decimal;
  ebitda: Decimal;
  depreciation: Decimal;
  ebit: Decimal;
  interestExpense: Decimal;
  profitBeforeTax: Decimal;
  incomeTax: Decimal;
  netProfit: Decimal;
  traces: Record<string, CalculationTrace>;
}

export function calculatePL(
  assumptions: FinanceAssumptions,
  revenue: RevenueResult,
  directCosts: DirectCostsResult,
  operatingExpenses: OperatingExpensesResult
): PLResult {
  const netRevenue = revenue.netRevenue;
  const direct = directCosts.totalDirectCosts;
  const grossProfit = netRevenue.minus(direct);
  const grossMarginPct = netRevenue.isZero()
    ? new Decimal(0)
    : grossProfit.dividedBy(netRevenue).times(100);

  const opex = operatingExpenses.totalOperatingExpenses;
  const ebitda = grossProfit.minus(opex);
  const depreciation = calculateDepreciation(assumptions);
  const ebit = ebitda.minus(depreciation);
  const interestExpense = calculateLoanInterest(assumptions);
  const profitBeforeTax = ebit.minus(interestExpense);
  const incomeTax = profitBeforeTax.isPositive()
    ? profitBeforeTax.times(d(assumptions.incomeTaxRatePct).dividedBy(100))
    : new Decimal(0);
  const netProfit = profitBeforeTax.minus(incomeTax);

  return {
    grossBookings: revenue.grossBookings,
    discounts: revenue.discounts,
    refunds: revenue.refunds,
    grossCustomerBillings: revenue.grossCustomerBillings,
    gstCollected: revenue.gstCollected,
    netRevenue,
    directCosts: direct,
    grossProfit,
    grossMarginPct,
    operatingExpenses: opex,
    ebitda,
    depreciation,
    ebit,
    interestExpense,
    profitBeforeTax,
    incomeTax,
    netProfit,
    traces: {
      grossProfit: trace(
        "Gross profit",
        "Net revenue − direct costs",
        "INR/month",
        [
          { label: "Net revenue", expression: netRevenue.toString(), result: netRevenue },
          { label: "Direct costs", expression: direct.toString(), result: direct },
          { label: "Gross profit", expression: `${netRevenue} − ${direct}`, result: grossProfit },
        ],
        grossProfit
      ),
      ebitda: trace(
        "EBITDA",
        "Gross profit − operating expenses",
        "INR/month",
        [
          { label: "Gross profit", expression: grossProfit.toString(), result: grossProfit },
          { label: "Operating expenses", expression: opex.toString(), result: opex },
          { label: "EBITDA", expression: `${grossProfit} − ${opex}`, result: ebitda },
        ],
        ebitda
      ),
      ebit: trace(
        "EBIT",
        "EBITDA − depreciation",
        "INR/month",
        [
          { label: "EBITDA", expression: ebitda.toString(), result: ebitda },
          { label: "Depreciation", expression: depreciation.toString(), result: depreciation },
          { label: "EBIT", expression: `${ebitda} − ${depreciation}`, result: ebit },
        ],
        ebit
      ),
      netProfit: trace(
        "Planning net profit",
        "Net sales − direct costs − opex − depreciation − interest − income tax",
        "INR/month",
        [
          { label: "PBT", expression: profitBeforeTax.toString(), result: profitBeforeTax },
          { label: "Tax", expression: incomeTax.toString(), result: incomeTax },
          { label: "Net profit", expression: `${profitBeforeTax} − ${incomeTax}`, result: netProfit },
        ],
        netProfit
      ),
    },
  };
}
