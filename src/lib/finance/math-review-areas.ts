/**
 * Registry of math areas reviewers can flag — maps to navigation pages.
 */
import type { MathReviewItem } from "./schemas";

export interface MathReviewArea {
  id: string;
  label: string;
  href: string;
  group: "Plan" | "Operate" | "Economics" | "Track";
  description: string;
}

export const MATH_REVIEW_AREAS: MathReviewArea[] = [
  {
    id: "overview",
    label: "Math overview",
    href: "/math",
    group: "Plan",
    description: "Summary metrics and cross-page consistency",
  },
  {
    id: "sales_target",
    label: "Sales & Client Target",
    href: "/math/sales-target",
    group: "Plan",
    description: "Profit-backwards sales solver and custom mix",
  },
  {
    id: "scenarios",
    label: "Scenario Analysis",
    href: "/math/scenarios",
    group: "Plan",
    description: "Base case vs conservative vs upside scenarios",
  },
  {
    id: "optimise",
    label: "Optimise",
    href: "/math/optimise",
    group: "Plan",
    description: "Paths to hit profit targets via levers",
  },
  {
    id: "assumptions",
    label: "Assumptions",
    href: "/math/assumptions",
    group: "Plan",
    description: "Rent, staffing, tax, ramp-up, and global inputs",
  },
  {
    id: "capacity",
    label: "Capacity",
    href: "/math/capacity",
    group: "Operate",
    description: "Reformer spots, occupancy, utilisation, and optional weekly schedule",
  },
  {
    id: "access_products",
    label: "Access Products",
    href: "/math/access-products",
    group: "Operate",
    description: "Flexible packs, standing, standby economics",
  },
  {
    id: "pricing",
    label: "Pricing",
    href: "/math/pricing",
    group: "Operate",
    description: "Product prices and GST treatment",
  },
  {
    id: "unit_economics",
    label: "Unit Economics",
    href: "/math/unit-economics",
    group: "Economics",
    description: "Per-session contribution and credit liability",
  },
  {
    id: "pl",
    label: "P&L",
    href: "/math/pl",
    group: "Economics",
    description: "Monthly profit & loss statement",
  },
  {
    id: "cash_flow",
    label: "Cash Flow",
    href: "/math/cash-flow",
    group: "Economics",
    description: "Bank cash vs investment recovery",
  },
  {
    id: "break_even",
    label: "Break-even",
    href: "/math/break-even",
    group: "Economics",
    description: "Occupancy and cash break-even thresholds",
  },
  {
    id: "payback",
    label: "Investment recovery",
    href: "/math/payback",
    group: "Economics",
    description: "Payback hurdle and recovery position",
  },
];

export function getMathReviewArea(id: string): MathReviewArea | undefined {
  return MATH_REVIEW_AREAS.find((a) => a.id === id);
}

export function getMathReviewAreaByHref(href: string): MathReviewArea | undefined {
  const normalized = href.split("?")[0];
  return MATH_REVIEW_AREAS.find(
    (a) => normalized === a.href || normalized.startsWith(`${a.href}/`)
  );
}

export const MATH_REVIEW_TYPE_LABELS: Record<
  MathReviewItem["reviewType"],
  string
> = {
  accuracy_check: "Accuracy check",
  calculation_bug: "Calculation bug",
  recommendation: "Recommendation",
  ca_question: "CA / advisor question",
  other: "Other",
};

export const MATH_REVIEW_STATUS_LABELS: Record<
  MathReviewItem["status"],
  string
> = {
  open: "Open",
  acknowledged: "Acknowledged",
  fixed: "Fixed",
  wont_fix: "Won't fix",
  verified: "Verified",
};

export const MATH_REVIEW_ACCURACY_LABELS: Record<
  MathReviewItem["accuracyRating"],
  string
> = {
  not_reviewed: "Not reviewed",
  looks_correct: "Looks correct",
  needs_review: "Needs review",
  incorrect: "Incorrect",
};
