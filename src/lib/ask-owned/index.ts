export { classifyOwnedQuestion } from "./classify";
export { getOwnedPageContext } from "./page-context";
export { searchOwnedGuide, guideHref } from "./guide-search";
export { parseIndianAmount } from "./parse-indian-number";
export {
  parseWhatIfQuestion,
  buildWhatIfPatch,
  runOwnedWhatIf,
  WHAT_IF_UNSUPPORTED_MESSAGE,
} from "./what-if";
export {
  getBlendedNetSalesTrace,
  getPlanningNetProfitTrace,
  getMetricTraceForPage,
  renderTraceBody,
  extractMonthFromQuestion,
} from "./traces";
export { runOwnedHealthChecks, renderHealthCheckAnswer } from "./health-checks";
export { answerOwnedQuestion } from "./answer";
export { tryAnswerMathQuestion, extractSnapshotFromAnswer } from "./math-router";
export type { CalculationSnapshot } from "./calculation-snapshot";
export { parseFullClassSize, parseOccupancyFromQuestion, isClassCountQuestion } from "./capacity-answers";
export {
  loadAskOwnedHistory,
  saveAskOwnedEntry,
  clearAskOwnedHistory,
  logUnknownQuestion,
  createConversationEntry,
} from "./persistence";
export type {
  QuestionCategory,
  OwnedAnswer,
  OwnedPageContext,
  AskOwnedContext,
  AskOwnedConversationEntry,
  MetricTrace,
  WhatIfResult,
  WhatIfApplyAction,
  GuideLink,
} from "./types";
