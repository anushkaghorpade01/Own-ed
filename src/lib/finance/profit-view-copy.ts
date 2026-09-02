/**
 * Shared copy for the three profit views — keep UI tooltips and Guide aligned.
 */

export const PROFIT_VIEWS_GUIDE_HREF = "/guide#profit-views";

export const MONTH_FORECAST_PROFIT_TOOLTIP =
  "Your forecast for this specific month, including ramp-up and month-specific price or cost changes. Not driven by the sales quantities you enter below.";

export const STEADY_STATE_PL_TOOLTIP =
  "A representative month at your target booked occupancy. Not a specific ramp-up month — see Sales & Client Target for Month X forecast profit.";

export const SALES_PLAN_PROFIT_TOOLTIP =
  "Profit produced by the exact sales quantities you've entered here. A what-if — separate from the Month X forecast.";

export const PLANNING_NET_PROFIT_TOOLTIP =
  "Net sales minus direct costs, operating expenses, depreciation, interest, and tax. Depreciation is included even though it is not cash leaving your bank that month.";

export function incomeTaxLineLabel(taxRatePct: number): string {
  return `Income tax @ ${taxRatePct}%`;
}

export const INCOME_TAX_LINE_TOOLTIP =
  "Applied to profit before tax (EBITDA minus depreciation and interest) when that amount is positive. Change the rate under Assumptions → Depreciation & tax → Income tax rate.";
