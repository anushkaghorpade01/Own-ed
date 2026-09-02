import type { QuestionCategory } from "./types";

const RULES: Array<{ category: QuestionCategory; patterns: RegExp[] }> = [
  {
    category: "WHAT_IF",
    patterns: [
      /what\s+(?:if|happens\s+if)/i,
      /what\s+would\s+happen/i,
      /if\s+(?:rent|occupancy|private|drop)/i,
    ],
  },
  {
    category: "MODEL_HEALTH_CHECK",
    patterns: [/is\s+this\s+wrong/i, /something\s+wrong/i, /health\s+check/i, /reconcile/i],
  },
  {
    category: "PROFIT_VS_CASH",
    patterns: [
      /profit\s+(?:vs|versus|and)\s+cash/i,
      /cash\s+(?:vs|versus|and|different\s+from)\s+profit/i,
      /why\s+is\s+(?:profit|cash)\s+different\s+from\s+(?:cash|profit)/i,
    ],
  },
  {
    category: "COMPARE_PROFIT_VIEWS",
    patterns: [
      /profit\s+different/i,
      /different\s+profit/i,
      /month\s*\d+\s+profit/i,
      /why\s+is\s+.*profit\s+(?:low|different|lower)/i,
      /steady[- ]state/i,
      /forecast\s+profit/i,
      /sales\s+plan\s+profit/i,
    ],
  },
  {
    category: "INVESTMENT_RECOVERY",
    patterns: [
      /recover\s+(?:my\s+)?investment/i,
      /payback/i,
      /investment\s+recovery/i,
      /zero\s+line/i,
      /why\s+is\s+this\s+negative/i,
    ],
  },
  {
    category: "BANK_CASH",
    patterns: [/bank\s+cash/i, /cash\s+negative/i, /lowest\s+cash/i, /liquidity/i],
  },
  {
    category: "FUNDING",
    patterns: [/funding\s+gap/i, /how\s+much\s+funding/i, /founder\s+(?:equity|funding)/i, /need\s+₹/i],
  },
  {
    category: "SALES_CLIENT_TARGET",
    patterns: [
      /how\s+many\s+clients/i,
      /sales\s+(?:target|plan)/i,
      /client\s+target/i,
      /sales\s+plan.*service\s+mix/i,
      /service\s+mix.*sales\s+plan/i,
      /why doesn'?t my sales plan/i,
    ],
  },
  {
    category: "BREAK_EVEN",
    patterns: [/break[- ]?even/i],
  },
  {
    category: "CAPACITY",
    patterns: [
      /how many classes/i,
      /class count/i,
      /completely booked/i,
      /fully booked/i,
      /\d+\s*\/\s*\d+/,
      /at\s+\d+\s*%\s*occupancy.*class/i,
      /occupancy.*how many class/i,
      /reformer\s+spots/i,
      /how\s+many\s+spots/i,
      /classes\s+per/i,
    ],
  },
  {
    category: "OCCUPANCY",
    patterns: [/occupancy/i, /utilisation/i, /utilization/i],
  },
  {
    category: "SERVICE_MIX",
    patterns: [/service\s+demand\s+mix/i, /product\s+mix/i, /access\s+mix/i],
  },
  {
    category: "CREDITS",
    patterns: [/credits?\s+sold/i, /credits?\s+used/i, /redemption/i, /credit\s+pack/i],
  },
  {
    category: "PRICING",
    patterns: [/price/i, /pricing/i, /gst/i],
  },
  {
    category: "EXPLAIN_METRIC",
    patterns: [
      /where\s+(?:does|is)\s+this\s+(?:number|come)/i,
      /how\s+is\s+.*calculated/i,
      /how\s+is\s+this\s+(?:number|calculated)/i,
      /what\s+does\s+this\s+mean/i,
      /what\s+is\s+this/i,
    ],
  },
  {
    category: "EXPLAIN_TERM",
    patterns: [
      /^what\s+is\s+/i,
      /^explain\s+/i,
      /what\s+does\s+.+\s+mean/i,
    ],
  },
];

export function classifyOwnedQuestion(question: string, pathname: string): QuestionCategory {
  const q = question.trim();
  if (!q) return "UNKNOWN";

  for (const { category, patterns } of RULES) {
    if (patterns.some((p) => p.test(q))) return category;
  }

  if (/guide|help|how\s+do\s+i|how\s+to/i.test(q)) return "GUIDE_SEARCH";

  if (pathname.includes("/sales-target") && /profit|target|client/i.test(q)) {
    return "SALES_CLIENT_TARGET";
  }
  if (pathname.includes("/payback") || pathname.includes("/cash-flow")) {
    if (/recover|investment/i.test(q)) return "INVESTMENT_RECOVERY";
    if (/cash|funding/i.test(q)) return "BANK_CASH";
  }
  if (pathname.includes("/pl") && /profit|different/i.test(q)) return "COMPARE_PROFIT_VIEWS";

  return "UNKNOWN";
}
