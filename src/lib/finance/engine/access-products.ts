import { d, WEEKS_PER_MONTH, trace, type CalculationTrace } from "../decimal";
import type { AccessProductMix, FinanceAssumptions, Product } from "../schemas";
import Decimal from "decimal.js";
import {
  calculateWeightedRealisedRevenue,
  productGrossPrice,
  productNetPrice,
  productNetRevenuePerCredit,
  stripGst,
  getEffectiveGstMode,
  getEffectiveGstModeForAssumptions,
} from "./revenue";
import {
  analyzeStandingSpotReservations,
  standingSpotClassesPerMonth,
  isStandingSpotRecurring,
  standingSpotMinCommitmentMonths,
  STANDING_SPOT_EXPLAINER,
} from "./standing-spots";
import {
  contributionPerSession,
  expectedContributionWithAttendance,
  expectedFlexibleContribution,
  netRevenueForTargetContribution,
  netToGrossPrice,
  variableCostPerAttendedSeat,
  paymentFeeOnNet,
} from "./contribution";
import type { CapacityResult } from "./capacity";
import { simulateStandbyAccessEconomics } from "./standby";
import {
  analyzeFlexiblePack,
  analyzeFlexiblePackPortfolio,
  listFlexiblePacks,
  runValidityStressTest,
  type FlexiblePackEconomics,
  type ValidityStressScenario,
} from "./flexible-packs";
import { buildCreditLedgerFromAssumptions, type CreditLedgerResult } from "./credit-ledger";
import { calculateCreditHealth, type CreditHealthResult } from "./credit-health";

export type AccessProductKind =
  | "drop_in"
  | "credit_pack"
  | "standing_spot"
  | "standby"
  | "private"
  | "duo"
  | "trial";

export interface ThreeTypesPredictability {
  cashCertainty: "yes" | "no" | "partial";
  cashCertaintyNote: string;
  classOccupancyCertainty: "yes" | "no";
  classOccupancyCertaintyNote: string;
  futurePeriodRevenueVisibility: "yes" | "no" | "partial";
  futurePeriodRevenueVisibilityNote: string;
}

export interface AccessProductNarrative {
  howItWorks: string;
  whatCustomerGets: string;
  whatOwnGets: string;
  whatOwnGivesUp: string;
  risks: string[];
  whyThisProductMightExist: string;
}

export interface AccessProductAnalysis {
  kind: AccessProductKind;
  id: string;
  name: string;
  narrative: AccessProductNarrative;
  predictability: ThreeTypesPredictability;
  financialInputs: Record<string, string | number | boolean>;
  financialOutputs: Record<string, Decimal>;
  traces: Record<string, CalculationTrace>;
}

export interface StandingSpotPremiumScenario {
  premiumPct: number;
  label: string;
  netMonthlyRevenue: Decimal;
  netRevenuePerSession: Decimal;
  standingSpotContribution: Decimal;
  expectedFlexibleContribution: Decimal;
  capacityReservationValue: Decimal;
  premiumVsComparable: Decimal;
}

export interface StandingSpotAccessAnalysis extends AccessProductAnalysis {
  kind: "standing_spot";
  sensitivity: {
    fillProbabilities: number[];
    premiumPcts: number[];
    cells: Decimal[][];
  };
  premiumScenarios: StandingSpotPremiumScenario[];
  economicNeutralGrossMonthlyPrice: Decimal;
  customPremiumPct: number;
}

export interface StandbyAccessAnalysis extends AccessProductAnalysis {
  kind: "standby";
  breakEvenCannibalisationPct: Decimal;
  breakEvenExplanation: string;
}

export interface ProductComparisonRow {
  label: string;
  dropIn: string;
  flexiblePack: string;
  standingSpot: string;
  standby: string;
  private: string;
  duo: string;
}

export interface AccessProductsResult {
  products: AccessProductAnalysis[];
  flexiblePacks: FlexiblePackEconomics[];
  flexiblePackPortfolio: ReturnType<typeof analyzeFlexiblePackPortfolio>;
  creditLedger: CreditLedgerResult;
  creditHealth: CreditHealthResult;
  standingSpot: StandingSpotAccessAnalysis | null;
  standby: StandbyAccessAnalysis | null;
  productComparison: ProductComparisonRow[];
  accessProductMix: AccessProductMix & { mixValid: boolean; mixTotal: Decimal };
  methodologyNote: string;
  traces: Record<string, CalculationTrace>;
}

const DEFAULT_MIX: AccessProductMix = {
  flexiblePackPct: 60,
  standingSpotPct: 15,
  dropInPct: 10,
  standbyPct: 5,
  privateDuoPct: 10,
  trialPct: 0,
};

const FILL_PROB_ROWS = [40, 60, 80, 90, 100];
const PREMIUM_COLS = [0, 5, 10, 15, 20];

function resolveMix(assumptions: FinanceAssumptions): AccessProductMix {
  return { ...DEFAULT_MIX, ...assumptions.accessProductMix };
}

function findProduct(
  assumptions: FinanceAssumptions,
  type: Product["type"],
  id?: string
): Product | undefined {
  if (id) {
    return assumptions.products.find((p) => p.id === id);
  }
  return assumptions.products.find((p) => p.type === type);
}

function weightedCreditPack(assumptions: FinanceAssumptions): Product | undefined {
  const packs = assumptions.products.filter((p) => p.type === "credit_pack");
  if (packs.length === 0) return undefined;
  return packs.reduce((best, p) =>
    p.packageMixPct > (best?.packageMixPct ?? 0) ? p : best
  );
}

export function analyzeDropIn(assumptions: FinanceAssumptions): AccessProductAnalysis | null {
  const product = findProduct(assumptions, "drop_in");
  if (!product) return null;

  const netPerSession = productNetPrice(product, assumptions);
  const grossPerSession = productGrossPrice(product, assumptions);
  const contribution = contributionPerSession(assumptions, netPerSession);
  const weighted = calculateWeightedRealisedRevenue(assumptions);
  const premiumVsPack = netPerSession.minus(
    weighted.weightedNetRevenuePerCredit
  );

  return {
    kind: "drop_in",
    id: product.id,
    name: product.name,
    narrative: {
      howItWorks:
        "Customer pays per session with no package commitment. Books into available flexible capacity.",
      whatCustomerGets:
        "Maximum timing flexibility — choose any eligible class without pre-purchasing credits.",
      whatOwnGets:
        "Highest per-session net revenue and immediate cash for that visit.",
      whatOwnGivesUp:
        "No future booking certainty, no committed occupancy, and no multi-session revenue visibility.",
      risks: [
        "Demand is unpredictable session-to-session.",
        "Higher per-session price may limit conversion vs packs.",
      ],
      whyThisProductMightExist:
        "Captures occasional visitors, tourists, and members who want to try before committing to a pack.",
    },
    predictability: {
      cashCertainty: "yes",
      cashCertaintyNote: "Customer pays before or at the session.",
      classOccupancyCertainty: "no",
      classOccupancyCertaintyNote:
        "Drop-in demand is not tied to a specific recurring class time.",
      futurePeriodRevenueVisibility: "no",
      futurePeriodRevenueVisibilityNote:
        "No contractual future months unless a recurring agreement exists (not typical for drop-in).",
    },
    financialInputs: {
      grossPrice: grossPerSession.toNumber(),
      gstRatePct: assumptions.gstRatePct,
      peakEligible: product.peakEligible,
      classEligibility: product.classEligibility.join(", ") || "All eligible classes",
    },
    financialOutputs: {
      netRevenuePerSession: netPerSession,
      contributionPerSession: contribution,
      premiumVsFlexiblePack: premiumVsPack,
      cashCollected: grossPerSession,
    },
    traces: {
      contribution: trace(
        "Drop-in contribution per session",
        "net revenue − variable costs − payment fee",
        "INR/session",
        [{ label: "Contribution", expression: contribution.toString(), result: contribution }],
        contribution
      ),
    },
  };
}

export function analyzeFlexibleCreditPack(
  assumptions: FinanceAssumptions
): AccessProductAnalysis | null {
  const portfolio = analyzeFlexiblePackPortfolio(assumptions);
  const packs = listFlexiblePacks(assumptions);
  if (packs.length === 0) return null;

  const primary =
    packs.reduce(
      (best, p) => (p.packageMixPct > (best?.packageMixPct ?? -1) ? p : best),
      packs[0]
    ) ?? packs[0];
  const econ = analyzeFlexiblePack(primary, assumptions);
  const weighted = calculateWeightedRealisedRevenue(assumptions);

  return {
    kind: "credit_pack",
    id: "flexible-credit-portfolio",
    name: "Flexible Credit Packs (portfolio)",
    narrative: {
      howItWorks:
        "Customers prepay for a quantity of credits and redeem flexibly within validity — not a fixed weekly/monthly allocation.",
      whatCustomerGets:
        "Lower per-class economics than drop-in; flexibility to book eligible classes within pack validity.",
      whatOwnGets:
        "Cash and net sales at purchase; credits create a future service obligation for capacity planning.",
      whatOwnGivesUp:
        "Per-credit revenue is discounted vs drop-in; redemption timing and peak eligibility create capacity risk.",
      risks: [
        "Credits may concentrate redemption in peak slots.",
        "Longer validity keeps service obligations open longer.",
        "Refunds reduce cash retained — unredeemed credits are not lost revenue in this planning model.",
      ],
      whyThisProductMightExist:
        "Core flexible access — quantity + validity products (e.g. 8 credits / 8 weeks, 16 credits / 12 weeks).",
    },
    predictability: {
      cashCertainty: "yes",
      cashCertaintyNote: "Cash collected when pack is sold.",
      classOccupancyCertainty: "no",
      classOccupancyCertaintyNote: "Credits do not map to a specific recurring class time.",
      futurePeriodRevenueVisibility: "no",
      futurePeriodRevenueVisibilityNote:
        "Net sales are recognised at purchase in this planning model; redemption timing affects delivery costs only.",
    },
    financialInputs: {
      packCount: packs.length,
      primaryPack: primary.name,
      validityWeeks: econ.validityWeeks.toNumber(),
      creditsIncluded: primary.creditsIncluded,
      expectedRedemptionRatePct: econ.expectedRedemptionPct.toNumber(),
      expectedBreakagePct: econ.expectedBreakagePct.toNumber(),
      weightedNetPerCredit: weighted.weightedNetRevenuePerCredit.toNumber(),
    },
    financialOutputs: {
      cashCollected: portfolio.totalCashCollected,
      netPackageValue: econ.netPackageValue,
      nominalNetPerCredit: portfolio.blendedNetPerCredit,
      creditsOutstandingPerPurchase: d(primary.creditsIncluded),
      expectedRedemptions: econ.expectedCreditsRedeemed,
      expectedExpiredCredits: econ.expectedCreditsExpired,
      expectedUnusedCredits: econ.expectedCreditsUnused,
      expectedDeliveryCost: econ.expectedVariableCost,
      expectedContribution: econ.expectedContribution,
      contributionMarginPct: econ.contributionMarginPct,
      contributionPerRedeemedCredit: contributionPerSession(
        assumptions,
        portfolio.blendedNetPerCredit
      ),
      /** @deprecated use netPackageValue — full net sales at purchase */
      expectedEarnedRevenue: portfolio.totalExpectedEarnedRevenue,
      /** @deprecated always zero in planning model */
      deferredUnearnedRevenue: portfolio.totalDeferredRevenue,
    },
    traces: econ.traces,
  };
}

function buildStandingSpotPremiumScenario(
  assumptions: FinanceAssumptions,
  product: Product,
  comparableNetPerClass: Decimal,
  fillProbPct: number,
  attendanceProbPct: number,
  premiumPct: number,
  sessionsPerMonth: Decimal
): StandingSpotPremiumScenario {
  const premiumMultiplier = d(1).plus(d(premiumPct).dividedBy(100));
  const netPerSession = comparableNetPerClass.times(premiumMultiplier);
  const netMonthly = netPerSession.times(sessionsPerMonth);
  const contributionWhenAttended = contributionPerSession(
    assumptions,
    netPerSession
  );
  const standingContribution = expectedContributionWithAttendance(
    contributionWhenAttended,
    attendanceProbPct
  ).times(sessionsPerMonth);
  const flexContributionWhenOccupied = contributionPerSession(
    assumptions,
    comparableNetPerClass
  );
  const expectedFlex = expectedFlexibleContribution(
    flexContributionWhenOccupied,
    fillProbPct
  ).times(sessionsPerMonth);
  const reservationValue = standingContribution.minus(expectedFlex);

  return {
    premiumPct,
    label: premiumPct === 0 ? "Same effective price" : `+${premiumPct}%`,
    netMonthlyRevenue: netMonthly,
    netRevenuePerSession: netPerSession,
    standingSpotContribution: standingContribution,
    expectedFlexibleContribution: expectedFlex,
    capacityReservationValue: reservationValue,
    premiumVsComparable: netPerSession.minus(comparableNetPerClass),
  };
}

export function analyzeStandingSpotAccess(
  assumptions: FinanceAssumptions,
  monthlyAvailableSeats: Decimal,
  customPremiumPct = 0
): StandingSpotAccessAnalysis | null {
  const product = findProduct(assumptions, "standing_spot");
  if (!product) return null;

  const reservations = analyzeStandingSpotReservations(
    assumptions,
    monthlyAvailableSeats
  )[0];
  if (!reservations) return null;

  const comparableId =
    product.standingSpotComparableProductId ?? weightedCreditPack(assumptions)?.id;
  const comparableProduct = comparableId
    ? findProduct(assumptions, "credit_pack", comparableId)
    : weightedCreditPack(assumptions);
  const comparableNetPerClass = comparableProduct
    ? productNetRevenuePerCredit(comparableProduct, assumptions)
    : calculateWeightedRealisedRevenue(assumptions).weightedNetRevenuePerClass;

  const fillProb =
    product.standingSpotExpectedFlexibleFillProbabilityPct ?? 80;
  const attendanceProb =
    product.standingSpotMemberAttendanceProbabilityPct ?? 90;
  const sessionsPerMonth = standingSpotClassesPerMonth(product, assumptions);
  const reservedPerClass = d(product.standingSpotSeatsPerClass ?? 1);
  const reservedCapacity = sessionsPerMonth.times(reservedPerClass);

  const netPerSession = reservations.effectiveNetRevenuePerReservedClass;
  const contributionWhenAttended = contributionPerSession(
    assumptions,
    netPerSession
  );
  const standingSpotContribution = expectedContributionWithAttendance(
    contributionWhenAttended,
    attendanceProb
  ).times(sessionsPerMonth);
  const flexContributionWhenOccupied = contributionPerSession(
    assumptions,
    comparableNetPerClass
  );
  const expectedFlexContribution = expectedFlexibleContribution(
    flexContributionWhenOccupied,
    fillProb
  ).times(sessionsPerMonth);
  const capacityReservationValue = standingSpotContribution.minus(
    expectedFlexContribution
  );

  const targetContributionPerAttended = flexContributionWhenOccupied
    .times(d(fillProb).dividedBy(100))
    .dividedBy(d(attendanceProb).dividedBy(100));
  const neutralNetPerSession = netRevenueForTargetContribution(
    assumptions,
    targetContributionPerAttended
  );
  const economicNeutralGrossMonthly = netToGrossPrice(
    assumptions,
    neutralNetPerSession.times(sessionsPerMonth)
  );

  const premiumScenarios = [0, 5, 10, 15, customPremiumPct]
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort((a, b) => a - b)
    .map((pct) =>
      buildStandingSpotPremiumScenario(
        assumptions,
        product,
        comparableNetPerClass,
        fillProb,
        attendanceProb,
        pct,
        sessionsPerMonth
      )
    );

  const cells: Decimal[][] = FILL_PROB_ROWS.map((fill) =>
    PREMIUM_COLS.map((premium) =>
      buildStandingSpotPremiumScenario(
        assumptions,
        product,
        comparableNetPerClass,
        fill,
        attendanceProb,
        premium,
        sessionsPerMonth
      ).capacityReservationValue
    )
  );

  const recurring = isStandingSpotRecurring(product);
  const minMonths = standingSpotMinCommitmentMonths(product);

  return {
    kind: "standing_spot",
    id: product.id,
    name: product.name,
    narrative: {
      howItWorks: STANDING_SPOT_EXPLAINER,
      whatCustomerGets:
        "Guaranteed recurring access to a specific day/time — certainty, routine, and no booking competition for that slot.",
      whatOwnGets:
        "Class-level committed occupancy; future-period revenue visibility when recurring or minimum commitment exists.",
      whatOwnGivesUp:
        "Flexible inventory — the reserved reformer cannot be sold to flexible credit bookers for that class.",
      risks: [
        "Reserved seat may be priced below expected flexible contribution for that slot.",
        "Member no-shows still consume reserved capacity unless released and resold.",
        "Does not inherently provide greater cash certainty than another prepaid product.",
      ],
      whyThisProductMightExist:
        "A Standing Spot is not mainly valuable because the customer prepays — flexible packs also prepay. Its unique value is guaranteed recurring time for the member and known occupancy for OWN. The calculator compares whether that trade is financially worthwhile.",
    },
    predictability: {
      cashCertainty: recurring ? "yes" : "partial",
      cashCertaintyNote: recurring
        ? "Yes for the current billing period under recurring subscription."
        : "Cash collected per purchase period — comparable to other prepaid products.",
      classOccupancyCertainty: "yes",
      classOccupancyCertaintyNote:
        "Demand is mapped to a specific recurring class time.",
      futurePeriodRevenueVisibility:
        minMonths > 1 || recurring ? "yes" : "no",
      futurePeriodRevenueVisibilityNote:
        minMonths > 1
          ? `Yes for the ${minMonths}-month committed term.`
          : recurring
            ? "Partial — recurring billing continues but no fixed contract total without minimum term."
            : "No — comparable to one-time prepaid purchase.",
    },
    financialInputs: {
      comparableProduct: comparableProduct?.name ?? "Weighted credit pack",
      grossMonthlyPrice: productGrossPrice(product, assumptions).toNumber(),
      gstRatePct: assumptions.gstRatePct,
      reservedClassesPerWeek: product.standingSpotClassesPerWeek ?? 0,
      reservedDay: product.standingSpotReservedDay ?? "",
      reservedTime: product.standingSpotReservedTime ?? "",
      reformersReservedPerClass: product.standingSpotSeatsPerClass ?? 1,
      classCapacity: assumptions.maxGroupClassSize,
      minCommitmentMonths: minMonths,
      autoRenew: product.standingSpotAutoRenew ?? recurring,
      memberAttendanceProbabilityPct: attendanceProb,
      memberReleasePolicy: product.standingSpotMemberReleasePolicy ?? product.standingSpotMissedClassPolicy ?? "",
      releasedSeatResaleAllowed: product.standingSpotReleasedSeatResaleAllowed ?? false,
      expectedResaleProbabilityPct: product.standingSpotExpectedResaleProbabilityPct ?? 0,
      expectedFlexibleFillProbabilityPct: fillProb,
      variableCostPerAttendedSeat: variableCostPerAttendedSeat(assumptions).toNumber(),
    },
    financialOutputs: {
      netMonthlyStandingSpotRevenue: reservations.committedMonthlyRevenue,
      actualReservedSessionsInMonth: sessionsPerMonth,
      netRevenuePerReservedSession: netPerSession,
      premiumDiscountVsComparableFlexible: reservations.premiumDiscountVsCreditPack,
      reservedCapacity,
      remainingFlexibleCapacity: reservations.remainingFlexibleSeatsPerClass,
      committedClassOccupancyPct: reservations.committedOccupancyBeforeFlexiblePct,
      monthlyContractedRevenue: reservations.committedMonthlyRevenue,
      futureContractedRevenue:
        reservations.futureContractedRevenue ?? new Decimal(0),
      standingSpotContribution,
      expectedFlexibleContributionIfSameCapacity: expectedFlexContribution,
      capacityReservationValue,
      economicNeutralGrossMonthlyPrice: economicNeutralGrossMonthly,
    },
    traces: reservations.traces,
    sensitivity: {
      fillProbabilities: FILL_PROB_ROWS,
      premiumPcts: PREMIUM_COLS,
      cells,
    },
    premiumScenarios,
    economicNeutralGrossMonthlyPrice: economicNeutralGrossMonthly,
    customPremiumPct,
  };
}

export function analyzeStandbyAccess(
  assumptions: FinanceAssumptions
): StandbyAccessAnalysis | null {
  const product = findProduct(assumptions, "standby");
  if (!product) return null;

  const sim = simulateStandbyAccessEconomics(assumptions, product);
  const weighted = calculateWeightedRealisedRevenue(assumptions);

  return {
    kind: "standby",
    id: product.id,
    name: product.name,
    narrative: {
      howItWorks:
        "Standby accesses capacity that would otherwise remain unsold after normal bookings and waitlist demand. It must never displace confirmed normal members.",
      whatCustomerGets:
        "Discounted access to last-minute empty seats within a release window.",
      whatOwnGets:
        "Incremental contribution from otherwise empty capacity — if cannibalisation stays below break-even.",
      whatOwnGivesUp:
        "Potential full-price flexible sales if standby members would have purchased regular access anyway.",
      risks: [
        "Cannibalisation is an estimate — not certain lost revenue.",
        "Too-generous standby pricing can erode regular pack value.",
      ],
      whyThisProductMightExist:
        "Monetise unsold inventory without adding fixed capacity — useful when evening classes have recurring empty spots.",
    },
    predictability: {
      cashCertainty: "partial",
      cashCertaintyNote:
        "Per-claim or monthly fee — cash when claim is made or membership billed.",
      classOccupancyCertainty: "no",
      classOccupancyCertaintyNote:
        "Standby is opportunistic — no guaranteed class time.",
      futurePeriodRevenueVisibility: product.recurring ? "partial" : "no",
      futurePeriodRevenueVisibilityNote: product.recurring
        ? "Monthly membership fee provides some visibility."
        : "Pay-per-claim has no future contract.",
    },
    financialInputs: {
      pricePerSession: productGrossPrice(product, assumptions).toNumber(),
      maxUsesPerMonth: product.maxUsesPerMonth ?? 0,
      releaseWindowHours: product.standbyReleaseHoursBefore ?? 0,
      expectedAvailableEmptySeats:
        product.standbyExpectedAvailableEmptySeats ?? 40,
      expectedClaimRatePct: product.standbyExpectedClaimRatePct ?? 50,
      attendanceRatePct: product.standbyAttendanceRatePct ?? 90,
      estimatedCannibalisationPct: product.standbyCannibalisationPct ?? 30,
      regularContributionPerSession:
        product.standbyRegularContributionPerSession ??
        contributionPerSession(
          assumptions,
          weighted.weightedNetRevenuePerCredit
        ).toNumber(),
    },
    financialOutputs: {
      availableStandbyInventory: sim.availableStandbyInventory,
      expectedClaims: sim.expectedClaims,
      standbyNetRevenue: sim.standbyNetRevenue,
      standbyContribution: sim.standbyContribution,
      estimatedDisplacedRegularContribution: sim.estimatedDisplacedRegularContribution,
      netIncrementalContribution: sim.netIncrementalContribution,
      occupancyImprovement: sim.occupancyImprovement,
      breakEvenCannibalisationPct: sim.breakEvenCannibalisationPct,
    },
    traces: sim.traces,
    breakEvenCannibalisationPct: sim.breakEvenCannibalisationPct,
    breakEvenExplanation: sim.breakEvenExplanation,
  };
}

export function analyzePrivateAccess(
  assumptions: FinanceAssumptions
): AccessProductAnalysis {
  const mode = getEffectiveGstModeForAssumptions(assumptions);
  const netPerSession = stripGst(
    d(assumptions.privatePrice),
    assumptions.gstRatePct,
    mode
  ).net;
  const durationHours = d(assumptions.privateDurationMinutes ?? 55).dividedBy(60);
  const reformers = d(assumptions.privateReformersOccupied ?? 1);
  const instructorCost =
    (assumptions.privateInstructorCost ?? 0) > 0
    ? d(assumptions.privateInstructorCost)
    : d(assumptions.instructorPerClassPayout).plus(
        d(assumptions.instructorPerAttendeePayout)
      );
  const variableCosts = d(assumptions.sessionConsumables).plus(instructorCost);
  const paymentFee = paymentFeeOnNet(assumptions, netPerSession);
  const contribution = netPerSession.minus(variableCosts).minus(paymentFee);
  const netPerHour = durationHours.isZero()
    ? new Decimal(0)
    : netPerSession.dividedBy(durationHours);
  const contributionPerHour = durationHours.isZero()
    ? new Decimal(0)
    : contribution.dividedBy(durationHours);
  const contributionPerReformerHour = durationHours.isZero()
    ? new Decimal(0)
    : contribution.dividedBy(durationHours.times(reformers));

  const weighted = calculateWeightedRealisedRevenue(assumptions);
  const groupContribution = contributionPerSession(
    assumptions,
    weighted.weightedNetRevenuePerCredit
  );

  return {
    kind: "private",
    id: "private",
    name: "Private",
    narrative: {
      howItWorks:
        "One client (or focused session) occupies reformer(s) for a dedicated time slot at a premium session price.",
      whatCustomerGets: "Personal instruction, schedule control, and bespoke programming.",
      whatOwnGets: "High contribution per reformer-hour vs group when priced correctly.",
      whatOwnGivesUp: "Group scale economics — one reformer serves one client instead of up to class capacity.",
      risks: ["Instructor cost can erode margin if underpriced.", "Slot could alternatively host a full group class."],
      whyThisProductMightExist:
        "Premium tier for members wanting individual attention; also uses off-peak slots productively.",
    },
    predictability: {
      cashCertainty: "yes",
      cashCertaintyNote: "Typically paid per session or package upfront.",
      classOccupancyCertainty: "yes",
      classOccupancyCertaintyNote: "Dedicated scheduled slot.",
      futurePeriodRevenueVisibility: "partial",
      futurePeriodRevenueVisibilityNote: "Depends on repeat booking patterns — not a standing reservation product.",
    },
    financialInputs: {
      price: assumptions.privatePrice,
      durationMinutes: assumptions.privateDurationMinutes,
      reformersOccupied: assumptions.privateReformersOccupied,
      instructorCost: instructorCost.toNumber(),
      timeSlot: assumptions.privateTimeSlot ?? "Flexible",
    },
    financialOutputs: {
      netRevenuePerSession: netPerSession,
      netRevenuePerHour: netPerHour,
      contributionPerSession: contribution,
      contributionPerHour,
      contributionPerReformerHour,
      premiumVsGroupContribution: contribution.minus(groupContribution),
    },
    traces: {},
  };
}

export function analyzeDuoAccess(
  assumptions: FinanceAssumptions
): AccessProductAnalysis {
  const mode = getEffectiveGstModeForAssumptions(assumptions);
  const netPerPerson = stripGst(
    d(assumptions.duoPricePerPerson),
    assumptions.gstRatePct,
    mode
  ).net;
  const participants = d(assumptions.duoAvgPeople);
  const netPerSession = netPerPerson.times(participants);
  const durationHours = d(assumptions.duoDurationMinutes ?? 55).dividedBy(60);
  const reformers = d(assumptions.duoReformersConsumed ?? 1);
  const contribution = contributionPerSession(
    assumptions,
    netPerSession.dividedBy(participants)
  ).times(participants);
  const contributionPerPerson = participants.isZero()
    ? new Decimal(0)
    : contribution.dividedBy(participants);
  const contributionPerReformerHour = durationHours.isZero()
    ? new Decimal(0)
    : contribution.dividedBy(durationHours.times(reformers));

  return {
    kind: "duo",
    id: "duo",
    name: "Duo",
    narrative: {
      howItWorks:
        "Two participants share a semi-private session, each paying a per-person rate below full private.",
      whatCustomerGets: "Shared attention at a lower per-person price than private.",
      whatOwnGets: "Higher session revenue than single group seat; better reformer utilisation than 1:1 private.",
      whatOwnGivesUp: "Some per-person premium vs private; scheduling must align two clients.",
      risks: ["Partial empty duo slot if one cancels.", "Pricing must sit clearly between group and private."],
      whyThisProductMightExist:
        "Bridge product for friends or partners — captures willingness-to-pay above group but below private.",
    },
    predictability: {
      cashCertainty: "yes",
      cashCertaintyNote: "Paid per session or short package.",
      classOccupancyCertainty: "yes",
      classOccupancyCertaintyNote: "Dedicated scheduled slot for two clients.",
      futurePeriodRevenueVisibility: "no",
      futurePeriodRevenueVisibilityNote: "Typically session-by-session unless sold as a bundle.",
    },
    financialInputs: {
      pricePerPerson: assumptions.duoPricePerPerson,
      participants: assumptions.duoAvgPeople,
      durationMinutes: assumptions.duoDurationMinutes,
      reformersConsumed: assumptions.duoReformersConsumed,
    },
    financialOutputs: {
      totalSessionNetRevenue: netPerSession,
      contributionPerSession: contribution,
      contributionPerPerson,
      contributionPerReformerHour,
    },
    traces: {},
  };
}

export function analyzeTrialAccess(
  assumptions: FinanceAssumptions
): AccessProductAnalysis | null {
  const product = findProduct(assumptions, "trial");
  if (!product) return null;

  const netPerSession = productNetPrice(product, assumptions);
  const contribution = contributionPerSession(assumptions, netPerSession);
  const weighted = calculateWeightedRealisedRevenue(assumptions);

  return {
    kind: "trial",
    id: product.id,
    name: product.name,
    narrative: {
      howItWorks:
        "Introductory offer — typically one or a few sessions at a reduced price for new clients.",
      whatCustomerGets: "Low-risk way to experience OWN before buying a pack or membership.",
      whatOwnGets: "Acquisition — cash covers some variable cost; conversion to full-price products is the goal.",
      whatOwnGivesUp: "Full margin on the intro session; potential cannibalisation if existing members use it.",
      risks: [
        "May attract deal-seekers who do not convert.",
        "Must be eligibility-restricted to new clients.",
      ],
      whyThisProductMightExist:
        "Reduces trial friction in a premium category where drop-in pricing is a high bar.",
    },
    predictability: {
      cashCertainty: "yes",
      cashCertaintyNote: "Paid upfront for the intro offer.",
      classOccupancyCertainty: "no",
      classOccupancyCertaintyNote: "Flexible booking like drop-in.",
      futurePeriodRevenueVisibility: "no",
      futurePeriodRevenueVisibilityNote: "Conversion to other products is optional, not contracted.",
    },
    financialInputs: {
      grossPrice: productGrossPrice(product, assumptions).toNumber(),
      creditsIncluded: product.creditsIncluded,
      validityDays: product.validityDays ?? 14,
    },
    financialOutputs: {
      netRevenuePerSession: netPerSession,
      contributionPerSession: contribution,
      discountVsDropIn: weighted.weightedNetRevenuePerCredit.minus(netPerSession),
    },
    traces: {},
  };
}

function fmtCurrency(val: Decimal | undefined, fallback = "—"): string {
  if (!val) return fallback;
  return `₹${val.toFixed(0)}`;
}

function fmtPct(val: Decimal | undefined, fallback = "—"): string {
  if (!val) return fallback;
  return `${val.toFixed(0)}%`;
}

export function buildProductComparison(
  dropIn: AccessProductAnalysis | null,
  creditPack: AccessProductAnalysis | null,
  standingSpot: StandingSpotAccessAnalysis | null,
  standby: StandbyAccessAnalysis | null,
  privateSession: AccessProductAnalysis,
  duo: AccessProductAnalysis,
  trial: AccessProductAnalysis | null
): ProductComparisonRow[] {
  const row = (
    label: string,
    vals: [string, string, string, string, string, string]
  ): ProductComparisonRow => ({
    label,
    dropIn: vals[0],
    flexiblePack: vals[1],
    standingSpot: vals[2],
    standby: vals[3],
    private: vals[4],
    duo: vals[5],
  });

  return [
    row("Customer timing control", [
      "Maximum",
      "High",
      "Fixed recurring time",
      "Last-minute only",
      "Scheduled",
      "Scheduled",
    ]),
    row("Booking certainty", [
      "None",
      "Competitive booking",
      "Guaranteed slot",
      "If seat available",
      "Confirmed",
      "Confirmed",
    ]),
    row("Upfront cash", [
      dropIn?.predictability.cashCertaintyNote.slice(0, 40) ?? "—",
      "Yes — at pack purchase",
      standingSpot?.predictability.cashCertaintyNote.slice(0, 40) ?? "—",
      "Per claim / monthly",
      "Per session",
      "Per session",
    ]),
    row("Future commitment", [
      "None",
      creditPack?.predictability.futurePeriodRevenueVisibility ?? "—",
      standingSpot?.predictability.futurePeriodRevenueVisibility ?? "—",
      standby?.predictability.futurePeriodRevenueVisibility ?? "—",
      "Optional repeat",
      "Optional repeat",
    ]),
    row("Capacity reserved", [
      "No",
      "No",
      fmtPct(standingSpot?.financialOutputs.committedClassOccupancyPct),
      "No",
      "Yes — dedicated slot",
      "Yes — dedicated slot",
    ]),
    row("Effective revenue / session", [
      fmtCurrency(dropIn?.financialOutputs.netRevenuePerSession),
      fmtCurrency(creditPack?.financialOutputs.nominalNetPerCredit),
      fmtCurrency(standingSpot?.financialOutputs.netRevenuePerReservedSession),
      fmtCurrency(
        standby
          ? standby.financialOutputs.standbyNetRevenue.dividedBy(
              standby.financialOutputs.expectedClaims.isZero()
                ? d(1)
                : standby.financialOutputs.expectedClaims
            )
          : undefined
      ),
      fmtCurrency(privateSession.financialOutputs.netRevenuePerSession),
      fmtCurrency(
        duo.financialOutputs.totalSessionNetRevenue?.dividedBy(
          d(duo.financialInputs.participants as number)
        )
      ),
    ]),
    row("Contribution / session", [
      fmtCurrency(dropIn?.financialOutputs.contributionPerSession),
      fmtCurrency(creditPack?.financialOutputs.contributionPerRedeemedCredit),
      fmtCurrency(
        standingSpot
          ? standingSpot.financialOutputs.standingSpotContribution.dividedBy(
              standingSpot.financialOutputs.actualReservedSessionsInMonth.isZero()
                ? d(1)
                : standingSpot.financialOutputs.actualReservedSessionsInMonth
            )
          : undefined
      ),
      fmtCurrency(
        standby
          ? standby.financialOutputs.standbyContribution.dividedBy(
              standby.financialOutputs.expectedClaims.isZero()
                ? d(1)
                : standby.financialOutputs.expectedClaims
            )
          : undefined
      ),
      fmtCurrency(privateSession.financialOutputs.contributionPerSession),
      fmtCurrency(duo.financialOutputs.contributionPerPerson),
    ]),
    row("Contribution / reformer-hour", [
      "—",
      "—",
      "—",
      "—",
      fmtCurrency(privateSession.financialOutputs.contributionPerReformerHour),
      fmtCurrency(duo.financialOutputs.contributionPerReformerHour),
    ]),
    row("Inventory flexibility", [
      "Uses flexible pool",
      "Uses flexible pool",
      "Removes flexible inventory",
      "Uses leftover only",
      "Removes group slot",
      "Removes group slot",
    ]),
    row("Cannibalisation risk", [
      "Low",
      "Baseline",
      "Low",
      "Medium — estimated",
      "Low",
      "Low",
    ]),
    row("Customer value proposition", [
      dropIn?.narrative.whatCustomerGets.slice(0, 50) ?? "—",
      creditPack?.narrative.whatCustomerGets.slice(0, 50) ?? "—",
      standingSpot?.narrative.whatCustomerGets.slice(0, 50) ?? "—",
      standby?.narrative.whatCustomerGets.slice(0, 50) ?? "—",
      privateSession.narrative.whatCustomerGets.slice(0, 50),
      duo.narrative.whatCustomerGets.slice(0, 50),
    ]),
    row("OWN value proposition", [
      dropIn?.narrative.whatOwnGets.slice(0, 50) ?? "—",
      creditPack?.narrative.whatOwnGets.slice(0, 50) ?? "—",
      standingSpot?.narrative.whatOwnGets.slice(0, 50) ?? "—",
      standby?.narrative.whatOwnGets.slice(0, 50) ?? "—",
      privateSession.narrative.whatOwnGets.slice(0, 50),
      duo.narrative.whatOwnGets.slice(0, 50),
    ]),
  ];
}

export function calculateAccessProducts(
  assumptions: FinanceAssumptions,
  capacity: CapacityResult,
  customStandingSpotPremiumPct = 0
): AccessProductsResult {
  const dropIn = analyzeDropIn(assumptions);
  const creditPack = analyzeFlexibleCreditPack(assumptions);
  const standingSpot = analyzeStandingSpotAccess(
    assumptions,
    capacity.monthlyAvailableSeats,
    customStandingSpotPremiumPct
  );
  const standby = analyzeStandbyAccess(assumptions);
  const privateSession = analyzePrivateAccess(assumptions);
  const duo = analyzeDuoAccess(assumptions);
  const trial = analyzeTrialAccess(assumptions);

  const products: AccessProductAnalysis[] = [
    dropIn,
    creditPack,
    standingSpot,
    standby,
    privateSession,
    duo,
    trial,
  ].filter((p): p is AccessProductAnalysis => p != null);

  const mix = resolveMix(assumptions);
  const mixTotal = d(mix.flexiblePackPct)
    .plus(mix.standingSpotPct)
    .plus(mix.dropInPct)
    .plus(mix.standbyPct)
    .plus(mix.privateDuoPct)
    .plus(mix.trialPct);

  const flexiblePacks = listFlexiblePacks(assumptions).map((p) =>
    analyzeFlexiblePack(p, assumptions)
  );
  const flexiblePackPortfolio = analyzeFlexiblePackPortfolio(assumptions);
  const creditLedger = buildCreditLedgerFromAssumptions(assumptions);
  const creditHealth = calculateCreditHealth(assumptions, capacity);

  return {
    products,
    flexiblePacks,
    flexiblePackPortfolio,
    creditLedger,
    creditHealth,
    standingSpot,
    standby,
    productComparison: buildProductComparison(
      dropIn,
      creditPack,
      standingSpot,
      standby,
      privateSession,
      duo,
      trial
    ),
    accessProductMix: {
      ...mix,
      mixValid: mixTotal.equals(100),
      mixTotal,
    },
    methodologyNote:
      "Flexible packs are quantity + validity products. Net sales after GST are counted at purchase in this planning model; expected redemption affects delivery costs and capacity only. Standing Spot reserves calendar slots; Standby monetises likely-unsold capacity.",
    traces: {},
  };
}

export const ACCESS_PRODUCT_FORMULAS = {
  expectedFlexibleContribution:
    "contributionWhenOccupied × fillProbability — theoretical, not lost revenue",
  capacityReservationValue:
    "expectedStandingSpotContribution − expectedFlexibleContributionForSameCapacity",
  economicNeutralPrice:
    "Standing Spot net price where expected standing contribution equals expected flexible contribution for the slot",
  standbyIncremental:
    "standbyContribution − estimatedDisplacedRegularContribution",
  breakEvenCannibalisation:
    "standbyContributionPerClaim / regularContributionPerSession × 100",
} as const;
