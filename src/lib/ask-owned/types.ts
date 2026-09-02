import type { FinanceAssumptions } from "@/lib/finance/schemas";
import type { FinanceModelOutput } from "@/lib/finance/run-model";
import type { CalculationSnapshot } from "./calculation-snapshot";

export type QuestionCategory =
  | "EXPLAIN_TERM"
  | "EXPLAIN_METRIC"
  | "COMPARE_PROFIT_VIEWS"
  | "PROFIT_VS_CASH"
  | "INVESTMENT_RECOVERY"
  | "BANK_CASH"
  | "FUNDING"
  | "BREAK_EVEN"
  | "CAPACITY"
  | "OCCUPANCY"
  | "PRICING"
  | "SERVICE_MIX"
  | "CREDITS"
  | "SALES_CLIENT_TARGET"
  | "WHAT_IF"
  | "MODEL_HEALTH_CHECK"
  | "GUIDE_SEARCH"
  | "UNKNOWN";

export interface GuideLink {
  label: string;
  href: string;
}

export interface WhatIfApplyAction {
  label: string;
  patch: Partial<FinanceAssumptions>;
}

export interface OwnedAnswer {
  sections: Array<{ title?: string; body: string }>;
  guideLinks?: GuideLink[];
  whatIfApply?: WhatIfApplyAction;
  suggestedFollowUps?: string[];
  isFallback?: boolean;
  calculationSnapshot?: CalculationSnapshot;
}

export interface OwnedPageContext {
  route: string;
  title: string;
  guideSectionIds: string[];
  suggestedQuestions: string[];
}

export interface AskOwnedContext {
  pathname: string;
  assumptions: FinanceAssumptions;
  model: FinanceModelOutput;
  occupancyHint?: number;
  classSizeHint?: number;
  calculationSnapshot?: CalculationSnapshot;
}

export interface AskOwnedConversationEntry {
  id: string;
  question: string;
  answer: OwnedAnswer;
  route: string;
  timestamp: string;
  category: QuestionCategory;
}

export interface MetricTraceInput {
  label: string;
  value: number;
  formula?: string;
}

export interface MetricTrace {
  metric: string;
  formula: string;
  inputs: MetricTraceInput[];
  result: number;
}

export interface WhatIfResult {
  label: string;
  patch: Partial<FinanceAssumptions>;
  baseNetProfit: number;
  whatIfNetProfit: number;
  delta: number;
  baseBlended?: number;
  whatIfBlended?: number;
}
