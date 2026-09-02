/** Canonical copy and tooltips — Service Demand Mix vs Sales Plan vs Capacity. */

export const SALES_PLAN_GUIDE_HREF = "/guide#service-mix-vs-sales-plan";

export const SERVICE_DEMAND_MIX_TOOLTIP =
  "What I expect.\n\nThis is your forecast assumption for where occupied bookings are expected to come from across the studio.\n\nOWNED uses it to build the forecast.\n\nIt is not a rule that your manual Sales Plan has to follow.";

export const YOUR_SALES_PLAN_TOOLTIP =
  "What I want to test.\n\nEnter any combination of Drop-Ins, packs and Private sessions.\n\nOWNED will calculate what that sales plan means financially.\n\nIt does not have to match your forecast Service Demand Mix.";

export const YOUR_SALES_PLAN_CAPTION =
  "Test any combination of products and see what it could mean for net sales, profit and capacity.";

export const THREE_STEP = {
  serviceMix: {
    label: "Service demand mix",
    subtitle: "What I expect",
    tooltip:
      "Your Service Demand Mix is your forecast assumption.\n\nIt represents how you think occupied bookings may be split across services as the studio operates.\n\nOWNED uses this to build the forecast.",
  },
  salesPlan: {
    label: "Your sales plan",
    subtitle: "What I want to test",
    tooltip:
      "Your Sales Plan is a what-if.\n\nYou can enter any combination of products you want to test.\n\nIt does not need to match your forecast mix.",
  },
  capacity: {
    label: "Capacity check",
    subtitle: "Can I actually deliver it?",
    tooltip:
      "A sales plan can look financially attractive but still create more service demand than the studio can handle.\n\nOWNED checks whether your reformers, schedule and instructor time can deliver the demand created by the plan.\n\nThis is a feasibility check. It does not reduce the value of the sales you've entered.",
  },
} as const;

export const LOAD_FORECAST_TOOLTIP =
  "Loads OWNED's current forecasted sales quantities for the selected month into Your Sales Plan so you can edit and test them.";

export const SUGGEST_FROM_MIX_TOOLTIP =
  "Creates a starting Sales Plan designed to roughly reflect your forecast Service Demand Mix.\n\nYou can freely change any quantity after it loads.\n\nTargets your monthly profit goal — not net sales.";

export const NET_SALES_TARGET_TOOLTIP =
  "Enter the commercial net sales you want to reach this month.\n\nOWNED suggests how many of each product to sell, weighted by your Service Demand Mix (same logic as Suggest from service mix, but stopping at revenue instead of profit).\n\nNet sales here = transaction value when sold (pack price at purchase), not P&L booking economics.";

export const USE_NET_SALES_PLAN_TOOLTIP =
  "Loads the suggested quantities into Your Sales Plan so you can edit, check profit, and run the capacity check.";

export const STEADY_STATE_NET_SALES_TOOLTIP =
  "Sets the target to steady-state P&L net sales at your target booked occupancy.\n\nP&L may include duo, workshops and other revenue outside the sales plan grid — your plan covers core products only.";

export const CREDITS_CAPACITY_TOOLTIP =
  "Credits matter because they create future service demand.\n\nThey do not reduce the net sales value of a pack you have already sold.\n\nOWNED uses expected credit usage here only to check whether your studio can fulfil the bookings.";

export const SALES_NOT_BOOKINGS_TOOLTIP =
  "One 8-Pack sale creates 8 credits.\n\nOne 16-Pack sale creates 16 credits.\n\nOne Drop-In creates 1 credit.\n\nOne Private session creates 1 session.\n\nThat is why the number of products sold and the number of future bookings are different.";

export const FEASIBLE_TOOLTIP =
  "OWNED estimates that your current schedule and available capacity can service this sales plan under the current assumptions.\n\nFeasible does not mean customers will definitely buy this amount.";

export const FEASIBILITY_NOT_DEMAND_TOOLTIP =
  "OWNED can calculate whether your studio has enough capacity to deliver this plan.\n\nIt cannot guarantee that customers will actually buy it.\n\nRequired sales, forecast sales and physical capacity are different questions.";

export const DELIVERY_CAPACITY_SECTION_TITLE = "Delivery / capacity check";

export const COMMERCIAL_RESULT_TITLE = "Commercial result";
