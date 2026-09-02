/** Extract ₹ amounts from natural-language questions */
export function parseAmountFromQuestion(question: string): number | null {
  const q = question.toLowerCase();

  const lakh = q.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lac|lacs)\b/);
  if (lakh?.[1]) return Math.round(parseFloat(lakh[1]) * 100_000);

  const crore = q.match(/(\d+(?:\.\d+)?)\s*(?:crore|cr)\b/);
  if (crore?.[1]) return Math.round(parseFloat(crore[1]) * 10_000_000);

  const rupee = q.match(/₹\s*([\d,]+(?:\.\d+)?)/);
  if (rupee?.[1]) return Math.round(parseFloat(rupee[1].replace(/,/g, "")));

  return null;
}

export function isFundingBudgetQuestion(question: string): boolean {
  const q = question.toLowerCase();
  const hasBudget =
    parseAmountFromQuestion(question) != null ||
    /lakh|lakhs|invest|only have/i.test(q);
  const wantsCut =
    /reduce.*expense|cut.*cost|lower.*expense|enough.*cash|enough.*fund|get started|operating expense/i.test(
      q
    );
  return hasBudget && wantsCut;
}

export function isOnlyFounderFunding(question: string): boolean {
  return /only have|just have|all i have|no loan|without a loan/i.test(question.toLowerCase());
}

/** Target month for cash runway — default month 1 revenue timing */
export function parseRunwayTargetMonth(question: string, fallback = 1): number {
  const m = question.match(/month\s*(\d{1,2})/i);
  if (m?.[1]) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 36) return n;
  }
  return fallback;
}
