/** Common term aliases → dictionary search terms */
export const TERM_ALIASES: Record<string, string> = {
  "net sales": "net sales",
  contribution: "contribution",
  "contribution margin": "contribution margin",
  occupancy: "occupancy",
  "break-even": "break-even",
  breakeven: "break-even",
  payback: "payback",
  depreciation: "depreciation",
  "working capital": "working capital",
  "funding gap": "funding gap",
  "service demand mix": "service demand mix",
  "service mix": "service demand mix",
  steady: "steady-state",
  "steady-state": "steady-state",
  "steady state": "steady-state",
  bookings: "bookings",
  clients: "clients",
  credits: "credits",
  sales: "net sales",
};

export function extractTermQuery(question: string): string | null {
  const q = question.trim().toLowerCase();
  const whatIs = q.match(/^what\s+is\s+(?:a\s+|an\s+|the\s+)?(.+?)\??$/);
  if (whatIs) return whatIs[1]!.trim();
  const explain = q.match(/^explain\s+(.+?)\??$/);
  if (explain) return explain[1]!.trim();

  for (const [alias, term] of Object.entries(TERM_ALIASES)) {
    if (q.includes(alias)) return term;
  }
  return null;
}

export const COMMON_TERM_QUESTIONS = [
  "What is net sales?",
  "What is contribution?",
  "What is contribution margin?",
  "What is occupancy?",
  "What is break-even?",
  "What is payback?",
  "What is depreciation?",
  "What is working capital?",
  "What is a funding gap?",
  "What is service demand mix?",
  "What is the difference between sales and bookings?",
  "What is the difference between clients and transactions?",
  "What is the difference between credits sold and credits used?",
  "What is steady-state?",
];

export const TERM_GUIDE_MAP: Record<string, string> = {
  "net sales": "pricing",
  contribution: "unit-economics",
  "contribution margin": "unit-economics",
  occupancy: "capacity",
  "break-even": "break-even",
  payback: "payback",
  depreciation: "pl",
  "working capital": "cash-flow",
  "funding gap": "cash-flow",
  "service demand mix": "service-demand-mix",
  "steady-state": "profit-views",
  bookings: "dont-confuse",
  clients: "sales-vs-clients",
  credits: "credits",
};

export const DIFFERENCE_ANSWERS: Record<string, { title: string; body: string; guideId?: string }> = {
  "sales and bookings": {
    title: "Sales vs bookings",
    body: "A pack sale is one sale. Redemptions are many bookings over time as credits are used.",
    guideId: "dont-confuse",
  },
  "clients and transactions": {
    title: "Clients vs transactions",
    body: "One client can buy multiple products or book many sessions. Transactions count each purchase or booking separately.",
    guideId: "dont-confuse",
  },
  "credits sold and credits used": {
    title: "Credits sold vs credits used",
    body: "Credits are sold when purchased. Credits are used when redeemed on the schedule in your pack rules.",
    guideId: "credits",
  },
  "sales plan and service mix": {
    title: "Sales plan vs service demand mix",
    body: "Service Demand Mix is what you expect your bookings to look like.\n\nYour Sales Plan is a what-if combination you want to test.\n\nThey do not have to match.",
    guideId: "service-mix-vs-sales-plan",
  },
};
