/**
 * Plain-language copy for Credit liability on Capacity — tooltips + Guide alignment.
 */

export const CREDIT_LIABILITY_GUIDE_HREF = "/guide#credit-liability";

export const CREDIT_LIABILITY_SECTION_INTRO =
  "This block checks whether packs you have already sold can still be delivered. It uses your current assumptions — change occupancy or credit inputs and these numbers update automatically.";

export const CREDIT_LIABILITY_TWO_QUESTIONS =
  "OWNED is answering two separate questions here: (1) How full do we expect the studio to be each month? (2) How many classes do we still owe from credits already sold? They are shown side by side so you can see if leftover spots are enough for that backlog — especially at peak times.";

export const CREDIT_LIABILITY_ROW_TOOLTIPS: Record<string, string> = {
  "Total physical capacity":
    "Every reformer spot you schedule this month — all classes, all times. This is the ceiling: reformers × classes × operating days.",

  "Expected occupied capacity":
    "How many spots OWNED expects to be booked at your planned occupancy %. This is not a list of named people — it is a planning picture of “how full we run” for revenue and mix. Many of those spots would be pack holders redeeming credits.",

  "Uncommitted / remaining capacity":
    "Physical capacity minus expected occupied. These are spots not already counted in your occupancy plan — room for extra drop-ins, new pack redemptions, or the credit backlog below.",

  "Outstanding credits":
    "Credits from packs already sold that customers have not used yet. Normal for prepaid studios. Set under Assumptions → Credit liability.",

  "Expected redemptions before expiry":
    "Of those outstanding credits, how many you expect customers will actually use before they expire (not all 146 — some may expire unused). This is the service obligation OWNED compares to open spots. It is “before expiry”, not necessarily all in one month.",

  "Eligible capacity for credits":
    "Same as uncommitted remaining capacity — open spots where flexible credit holders could book. OWNED does not assume no-shows free these up automatically in this check.",

  "Peak-time eligible capacity":
    "Open spots in peak/eligible times only (e.g. evenings). A morning no-show does not help someone who can only book after work.",

  "Credits expected to expire unused (breakage)":
    "Credits you expect will never be redeemed. They reduce delivery pressure but are not “lost revenue” in this planning view unless you refund.",
};

export const CREDIT_LIABILITY_RATIO_TOOLTIPS = {
  eligibleCoverage:
    "Uncommitted spots ÷ expected redemptions before expiry.\n\n1.0× or above = enough leftover spots on paper.\nBelow 1.0× = tight.\n\nNote: this is a conservative check. Your expected occupied spots may already include many of the same pack members — OWNED does not fully merge those two views here.",

  peakCoverage:
    "Peak-time open spots ÷ expected redemptions.\n\nOften the real bottleneck: total capacity can look fine while evening slots are still too tight for pack members.",

  naiveCoverage:
    "Total physical capacity ÷ expected redemptions — ignores that many spots are already expected to be full. Shown greyed out on purpose. Do not use this ratio for decisions.",

  slotConstraintWarning:
    "Total capacity looks sufficient, but peak/eligible time slots may still be too constrained. Evening-only members cannot use morning capacity — even if those morning spots exist on paper.",
};

export const CREDIT_LIABILITY_GUIDE_LINK_LABEL = "Read the full guide: Credit liability & capacity";
