import { d } from "./decimal";
import type { FinanceModelOutput } from "./run-model";
import type { StandingSpotAnalysis } from "./engine/standing-spots";
import { formatINR } from "../format/currency";

export interface BusinessInsight {
  headline: string;
  explanation: string;
  action?: string;
  /** When true, show a disclaimer that this is theoretical / not a financial loss */
  isTheoretical?: boolean;
}

export function explainBreakEvenOccupancy(model: FinanceModelOutput): BusinessInsight {
  const pct = model.breakEven.contributionBreakEven.breakEvenOccupancyPct;
  const required = model.breakEven.contributionBreakEven.requiredOccupiedSeats;
  const available = model.capacity.monthlyAvailableSeats;
  const current = model.assumptions.projectedBookedOccupancyPct;
  const classSize = model.assumptions.maxGroupClassSize;
  const fullClassesNeeded = required.dividedBy(classSize);

  const pctNum = pct.toNumber();
  const currentNum = current;
  const gap = pctNum - currentNum;

  let headline = `${pct.toFixed(0)}% of seats must be occupied to cover fixed costs`;
  let explanation = `You have ${available.toFixed(0)} bookable seats per month. To cover rent, salaries, and other fixed bills from class contribution, you need ${required.toFixed(0)} seats actually occupied — roughly ${fullClassesNeeded.toFixed(0)} full classes (at ${classSize} people each). This is a planning threshold, not a statement about unused seats being financial losses.`;

  if (gap > 0) {
    explanation += ` At your planned ${currentNum}% occupancy, you're ${gap.toFixed(0)} percentage points below this threshold — about ${required.minus(model.capacity.occupiedSeatsMonthly).toFixed(0)} more occupied seats needed per month.`;
  } else {
    explanation += ` At your planned ${currentNum}% occupancy, you're above this threshold on a contribution basis.`;
  }

  return {
    headline,
    explanation,
    action: gap > 0
      ? "Consider raising occupancy, pricing, or reducing fixed costs."
      : "Focus on maintaining occupancy and contribution per delivered seat.",
  };
}

export function explainContributionMargin(model: FinanceModelOutput): BusinessInsight {
  const perSeat = model.unitEconomics.perSeat.contributionMarginPerSeat;
  const classSize = model.assumptions.maxGroupClassSize;
  const perFullClass = perSeat.times(classSize);

  return {
    headline: `Each delivered seat contributes ${formatINR(perSeat)} toward fixed costs`,
    explanation: `After direct variable costs (payment fees, consumables, instructor payouts), each occupied reformer spot that receives a delivered class contributes ${formatINR(perSeat)} toward covering fixed operating costs. A full class (${classSize}/${classSize}) contributes about ${formatINR(perFullClass)} on a contribution basis. Unscheduled or unbooked capacity is unused capacity — it is not automatically a financial loss in the model.`,
  };
}

export function explainEbitda(model: FinanceModelOutput): BusinessInsight {
  const ebitda = model.pl.ebitda;
  const revenue = model.revenue.netRevenue;

  if (ebitda.isPositive()) {
    return {
      headline: `Operating result: ${formatINR(ebitda)}/month EBITDA at planned occupancy`,
      explanation: `At ${model.assumptions.projectedBookedOccupancyPct}% booked occupancy, planning net sales of ${formatINR(revenue)} cover direct delivery costs and operating expenses, leaving ${formatINR(ebitda)} EBITDA. This differs from cash collected when packs are sold, and differs from unused capacity.`,
    };
  }

  return {
    headline: `Operating shortfall: ${formatINR(ebitda.abs())}/month EBITDA at planned occupancy`,
    explanation: `At ${model.assumptions.projectedBookedOccupancyPct}% occupancy, planning net sales do not cover all operating costs under this scenario. This is an operating result — not the same as unused capacity or cash timing from credit sales.`,
    action: "Check break-even occupancy and cash flow for timing differences.",
  };
}

export function explainGstMode(
  _priceEntryMode: "inclusive" | "exclusive",
  gstRate: number,
  exampleNetPrice: number
): BusinessInsight {
  const rate = gstRate / 100;
  const customerPays = Math.round(exampleNetPrice * (1 + rate));
  return {
    headline: "Prices are net sales ex-GST — customer pays is calculated",
    explanation: `When you enter ₹${exampleNetPrice.toLocaleString("en-IN")} net ex-GST at ${gstRate}% GST, customer pays ₹${customerPays.toLocaleString("en-IN")}. GST is not OWN revenue or profit.`,
  };
}

export function explainPayback(model: FinanceModelOutput): BusinessInsight {
  const pb = model.payback;
  const invested = model.capex.nonRecoverableCapex.plus(d(model.assumptions.workingCapital));
  const cashBasisNote =
    " Operating inflows follow earned-revenue timing (gross billings when services are modelled as delivered), not upfront prepaid pack purchase cash — payback may look faster than true cash recovery until prepaid timing is modelled.";

  if (pb.paybackNotReached) {
    return {
      headline: "Setup investment not recovered within 36 months at current plan",
      explanation: `About ${formatINR(invested)} in non-recoverable setup and working capital. Cumulative operating cash flow does not recover this within 3 years under current assumptions.${cashBasisNote}`,
      action: "Stress-test occupancy, pricing, or rent on the Scenarios page.",
    };
  }

  return {
    headline: `Setup investment recovered around month ${pb.paybackMonth}`,
    explanation: `Based on cumulative operating cash flow (not net profit or unused capacity).${cashBasisNote} Ramp-up occupancy is included.`,
  };
}

/** Warn when founder market-rate salary is excluded from opex */
export function explainOwnerCompensation(model: FinanceModelOutput): BusinessInsight | null {
  const a = model.assumptions;
  if (a.includeOwnerMarketRateComp || a.ownerInstructorSalary <= 0) return null;

  return {
    headline: "Founder teaching cost excluded from operating expenses",
    explanation: `Owner/instructor salary of ${formatINR(d(a.ownerInstructorSalary))}/month is not in EBITDA because "Include owner market-rate compensation" is off. Cash profitability may look better than economic profitability if the founder teaches without drawing salary. Turn on the toggle under Assumptions to see fully-loaded economics.`,
    action: "Review Assumptions → Owner instructor salary → Include market-rate compensation.",
  };
}

export function explainUtilisation(model: FinanceModelOutput): BusinessInsight {
  const bookedPct = model.assumptions.projectedBookedOccupancyPct;
  const occupied = model.capacity.occupiedSeatsMonthly;
  const available = model.capacity.monthlyAvailableSeats;
  const unused = model.unusedCapacity.unusedCapacity;

  return {
    headline: `${bookedPct}% of available reformer spots are expected to be booked`,
    explanation: `${occupied.toFixed(0)} of ${available.toFixed(0)} monthly spots are expected to be occupied under this scenario. That means ${unused.toFixed(0)} spots remain unused capacity — scheduled spots not expected to be booked. Unused capacity is not counted as a financial loss.`,
  };
}

export function explainUnrealisedRevenueOpportunity(model: FinanceModelOutput): BusinessInsight {
  const uc = model.unusedCapacity;
  const avg = uc.avgRealisedNetRevenuePerOccupiedSpot;

  return {
    headline: "Unused revenue capacity (theoretical)",
    explanation: `At your current average realised net revenue of ${formatINR(avg)} per occupied spot, filling all ${uc.unusedCapacity.toFixed(0)} currently unused spots would represent up to ${formatINR(uc.unrealisedRevenueOpportunity)} of additional monthly net revenue capacity. This is theoretical capacity, not lost revenue. It assumes sufficient additional paying demand exists and says nothing about cash collected vs earned revenue timing.`,
    isTheoretical: true,
    action: "Do not add this to P&L, cash flow, or payback calculations.",
  };
}

export function explainCreditCoverage(model: FinanceModelOutput): BusinessInsight {
  const cl = model.creditLiability;

  if (cl.slotConstraintDetected) {
    return {
      headline: "Total capacity looks sufficient — but eligible slots may not be",
      explanation: `Outstanding credits: ${cl.outstandingCredits.toFixed(0)}. Expected redemptions before expiry: ${cl.expectedRedemptionBeforeExpiry.toFixed(0)}. Uncommitted remaining capacity: ${cl.uncommittedRemainingCapacity.toFixed(0)} spots (not ${cl.totalPhysicalCapacity.toFixed(0)} total physical). Peak-time eligible remaining: ${cl.peakTimeEligibleCapacity.toFixed(0)} spots. ${cl.slotConstraintWarning}`,
      action: "Review which classes/times credits are eligible for before selling more packs.",
    };
  }

  if (cl.peakStatus === "red" || cl.status === "red") {
    return {
      headline: "Credit redemption capacity may be insufficient",
      explanation: `Expected redemptions (${cl.expectedRedemptionBeforeExpiry.toFixed(0)}) vs eligible remaining capacity (${cl.eligibleCapacityForCredits.toFixed(0)}), not total physical capacity (${cl.totalPhysicalCapacity.toFixed(0)}). Peak-time eligible: ${cl.peakTimeEligibleCapacity.toFixed(0)}. Expected occupied capacity already consumes ${cl.expectedOccupiedCapacity.toFixed(0)} spots.`,
      action: "Slow pack sales or add capacity in eligible time slots.",
    };
  }

  if (cl.peakStatus === "amber" || cl.status === "amber") {
    return {
      headline: "Credit redemption capacity is getting tight",
      explanation: `Eligible coverage: ${cl.eligibleCoverageRatio.toFixed(1)}×. Peak-time eligible coverage: ${cl.peakCoverageRatio.toFixed(1)}×. Based on ${cl.uncommittedRemainingCapacity.toFixed(0)} uncommitted spots after ${cl.expectedOccupiedCapacity.toFixed(0)} expected bookings — not raw total capacity.`,
      action: "Monitor peak slot availability for evening-only members.",
    };
  }

  return {
    headline: "Eligible capacity appears sufficient for expected credit redemptions",
    explanation: `${cl.expectedRedemptionBeforeExpiry.toFixed(0)} expected redemptions vs ${cl.eligibleCapacityForCredits.toFixed(0)} uncommitted remaining spots (after ${cl.expectedOccupiedCapacity.toFixed(0)} expected occupied). Peak-time eligible: ${cl.peakTimeEligibleCapacity.toFixed(0)}. Forecast only — confirm booking eligibility rules.`,
  };
}

export function explainBreakage(model: FinanceModelOutput): BusinessInsight | null {
  const cl = model.creditLiability;
  if (cl.creditsExpectedToExpireUnused.isZero()) return null;

  return {
    headline: `${cl.creditsExpectedToExpireUnused.toFixed(0)} credits forecast to expire unused`,
    explanation: `Unused credits reduce expected delivery costs and capacity consumption — they are not lost revenue in this planning model unless refunded. Breakage/expiry is tracked for capacity planning only.`,
  };
}

export function explainWeightedRevenue(model: FinanceModelOutput): BusinessInsight {
  const w = model.revenue.weightedRevenue.weightedNetRevenuePerCredit;
  return {
    headline: `Weighted nominal net price: ${formatINR(w)} per redeemed credit`,
    explanation: `Blended net sales per credit sold, weighted by credit redemption mix (not customer count). A 16-Pack buyer contributes more redeemed credits than a Drop-In buyer, so per-class economics reflect credit volume. Net sales are counted at purchase in this planning model.`,
  };
}

export function explainStandingSpotReservation(
  standingSpots: StandingSpotAnalysis[]
): BusinessInsight {
  const explainer =
    "Standing Spot is primarily a reservation product, not simply a prepaid package. The member pays for a recurring reformer at a specific time. This gives the member certainty and gives OWN committed occupancy for that class, but it also reduces the number of spots available to flexible members.";

  if (standingSpots.length === 0) {
    return {
      headline: "Standing Spot — capacity reservation product",
      explanation: explainer,
    };
  }

  const totalCommitted = standingSpots.reduce(
    (sum, ss) => sum + ss.committedMonthlyRevenue.toNumber(),
    0
  );
  const totalSacrificed = standingSpots.reduce(
    (sum, ss) => sum + ss.flexibleInventorySacrificed.toNumber(),
    0
  );
  const hasFuture = standingSpots.some((ss) => ss.hasFutureRevenueVisibility);

  return {
    headline: `Standing Spot reserves ${totalSacrificed.toFixed(0)} flexible seat-reservations/month`,
    explanation: `${explainer} Active reservations contribute ${formatINR(d(totalCommitted))} committed monthly revenue in the model. ${
      hasFuture
        ? "Where a recurring subscription or minimum commitment applies, contracted future revenue can be modelled separately from cash already collected on prepaid credit packs."
        : "Without a recurring subscription or minimum commitment, Standing Spot does not inherently provide greater future revenue predictability than a comparable prepaid pack — the difference is reserved capacity and member certainty."
    }`,
  };
}

export function explainGrossMargin(model: FinanceModelOutput): BusinessInsight {
  const gm = model.pl.grossMarginPct.toNumber();
  return {
    headline: `${gm.toFixed(0)}% of planning net sales remains after direct delivery costs`,
    explanation: `For every ₹100 of planning net sales, ₹${gm.toFixed(0)} remains after direct instructor, consumable, and payment costs (CM2 / gross profit). This reflects modelled delivery — not unused capacity.`,
  };
}

export function getModelInsights(model: FinanceModelOutput): BusinessInsight[] {
  const insights: BusinessInsight[] = [
    explainBreakEvenOccupancy(model),
    explainContributionMargin(model),
    explainEbitda(model),
    explainUtilisation(model),
    explainWeightedRevenue(model),
    explainPayback(model),
  ];
  const breakage = explainBreakage(model);
  if (breakage) insights.push(breakage);
  return insights;
}

/** Terminology reference — see finance-dictionary.ts for full glossary */
export { FINANCE_TERMINOLOGY, FINANCE_DICTIONARY } from "./finance-dictionary";
