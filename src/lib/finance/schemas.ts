import { z } from "zod";

export const GstTreatmentSchema = z.enum(["inclusive", "exclusive"]);
export const PriceEntryModeSchema = z.enum(["inclusive", "exclusive"]);

export const CustomExpenseSchema = z.object({
  id: z.string(),
  name: z.string(),
  amount: z.number().min(0),
  category: z.enum(["fixed", "variable"]),
  notes: z.string().optional(),
});

export type CustomExpense = z.infer<typeof CustomExpenseSchema>;

export const ValidityUnitSchema = z.enum(["days", "weeks", "months"]);
export const ValidityBeginsFromSchema = z.enum(["purchase", "activation"]);
export const ActivationPolicySchema = z.enum([
  "expire_if_not_activated",
  "auto_activate_on_purchase",
  "custom",
]);
export const StandingReleasePolicySchema = z.enum([
  "forfeit",
  "release_no_credit",
  "makeup_if_released_before_window",
  "makeup_if_resold",
  "custom",
]);

/** Rules for flexible credit packs (quantity + validity products, not monthly allocations). */
export const FlexiblePackRulesSchema = z.object({
  validityValue: z.number().positive(),
  validityUnit: ValidityUnitSchema.default("weeks"),
  validityBeginsFrom: ValidityBeginsFromSchema.default("activation"),
  activationDeadlineDays: z.number().int().positive().default(30),
  activationPolicy: ActivationPolicySchema.default("expire_if_not_activated"),
  eligibleClassTypes: z.array(z.string()).default([]),
  eligibleTimeBands: z.array(z.enum(["peak", "standard", "off_peak"])).default([]),
  bookingWindowHours: z.number().min(0).optional(),
  cancellationWindowHours: z.number().min(0).optional(),
  lateCancelPolicy: z.string().optional(),
  noShowPolicy: z.string().optional(),
  rolloverPolicy: z.string().optional(),
  extensionPolicy: z.string().optional(),
  freezePolicy: z.string().optional(),
  transferable: z.boolean().default(false),
  refundable: z.boolean().default(false),
  expectedRedemptionRatePct: z.number().min(0).max(100).default(90),
  expectedBreakageRatePct: z.number().min(0).max(100).default(10),
  expectedCancellationRatePct: z.number().min(0).max(100).default(5),
  expectedNoShowRatePct: z.number().min(0).max(100).default(3),
  expectedPeakBookingSharePct: z.number().min(0).max(100).default(50),
  /** Share of pack credits redeemed in each validity week (must sum to 100 when set). */
  redemptionCurvePctByWeek: z.array(z.number().min(0).max(100)).optional(),
  paymentProcessingRatePct: z.number().min(0).max(100).optional(),
  paymentProcessingFixedFee: z.number().min(0).optional(),
  variableCostPerAttendedSession: z.number().min(0).optional(),
  /** Modelling: packs sold per month for portfolio roll-up */
  expectedSalesVolumePerMonth: z.number().min(0).default(0),
  active: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
});

export type FlexiblePackRules = z.infer<typeof FlexiblePackRulesSchema>;

export const StandingSpotSlotSchema = z.object({
  day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
  startTime: z.string(),
  /** Expected flexible fill probability for this slot (0–100) */
  expectedFlexibleFillProbabilityPct: z.number().min(0).max(100).optional(),
});

export type StandingSpotSlot = z.infer<typeof StandingSpotSlotSchema>;

export const StandingSpotRulesSchema = z.object({
  recurringSlots: z.array(StandingSpotSlotSchema).default([]),
  /** Commitment lengths the studio offers (e.g. [1, 2] at launch) */
  commitmentMonthsOffered: z.array(z.number().int().positive()).default([1, 2]),
  /** Default commitment for modelling */
  defaultCommitmentMonths: z.number().int().positive().default(1),
  premiumPct: z.number().default(0),
  releasePolicy: StandingReleasePolicySchema.default("makeup_if_released_before_window"),
  releaseProbabilityPct: z.number().min(0).max(100).default(10),
  resaleProbabilityPct: z.number().min(0).max(100).default(50),
});

export type StandingSpotRules = z.infer<typeof StandingSpotRulesSchema>;

export const ValidityPresetSchema = z.enum(["tighter", "base", "generous"]);
export type ValidityPreset = z.infer<typeof ValidityPresetSchema>;

export const VALIDITY_PRESETS: Record<
  ValidityPreset,
  { pack8Weeks: number; pack16Weeks: number; label: string }
> = {
  tighter: { pack8Weeks: 6, pack16Weeks: 8, label: "Tighter validity" },
  base: { pack8Weeks: 8, pack16Weeks: 12, label: "Base case" },
  generous: { pack8Weeks: 10, pack16Weeks: 16, label: "Generous validity" },
};
export const ProductLifecycleSchema = z.enum(["draft", "active", "archived"]);
export type ProductLifecycle = z.infer<typeof ProductLifecycleSchema>;

/** Immutable snapshot of a product configuration at a point in time. */
export const ProductVersionSnapshotSchema = z.object({
  versionId: z.string(),
  versionNumber: z.number().int().positive(),
  product: z.lazy(() => ProductSchema),
  createdAt: z.string(),
  note: z.string().optional(),
});

export type ProductVersionSnapshot = z.infer<typeof ProductVersionSnapshotSchema>;

export const ProductTypeSchema = z.enum([
  "drop_in",
  "credit_pack",
  "standing_spot",
  "trial",
  "private",
  "duo",
  "standby",
  "workshop",
  "instructor_training",
  "studio_rental",
  "membership",
  "other",
]);

export const ClassScheduleEntrySchema = z.object({
  id: z.string(),
  day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
  startTime: z.string(),
  durationMinutes: z.number().int().positive(),
  classType: z.string(),
  capacity: z.number().int().positive(),
  peakOffPeak: z.enum(["peak", "off_peak", "neutral"]),
  instructor: z.string().optional(),
  minAttendance: z.number().int().min(0).default(0),
  recurring: z.boolean().default(true),
  status: z.enum(["planned", "active", "paused"]).default("planned"),
  bookedOccupancyPct: z.number().min(0).max(100).optional(),
  attendedOccupancyPct: z.number().min(0).max(100).optional(),
  waitlistCount: z.number().int().min(0).optional(),
  failedBookingAttempts: z.number().int().min(0).optional(),
});

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: ProductTypeSchema,
  price: z.number().min(0),
  /** draft | active | archived — only active products drive Base Case model */
  lifecycle: ProductLifecycleSchema.default("active"),
  /** Current configuration version — referenced by scenarios/snapshots/cohorts */
  versionId: z.string().optional(),
  versionNumber: z.number().int().positive().default(1),
  productCreatedAt: z.string().optional(),
  productUpdatedAt: z.string().optional(),
  /** When true (default), product follows global priceEntryMode */
  gstFollowsGlobal: z.boolean().default(true),
  /** Only applies when gstFollowsGlobal is false */
  gstTreatment: GstTreatmentSchema.default("exclusive"),
  creditsIncluded: z.number().int().min(0).default(1),
  validityDays: z.number().int().positive().optional(),
  classEligibility: z.array(z.string()).default([]),
  peakEligible: z.boolean().default(true),
  advanceBookingDays: z.number().int().min(0).optional(),
  recurring: z.boolean().default(false),
  maxUsesPerMonth: z.number().int().positive().optional(),
  discountPct: z.number().min(0).max(100).default(0),
  packageMixPct: z.number().min(0).max(100).default(0),
  standingSpotClassesPerWeek: z.number().min(0).optional(),
  standingSpotClassesPerMonth: z.number().min(0).optional(),
  standingSpotSeatsPerClass: z.number().int().min(0).optional(),
  standingSpotMaxSeatsPerClass: z.number().int().min(0).default(1),
  /** Recurring subscription billing (falls back to product.recurring) */
  standingSpotRecurringSubscription: z.boolean().optional(),
  standingSpotMinCommitmentMonths: z.number().int().min(0).optional(),
  standingSpotReservedDay: z
    .enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])
    .optional(),
  standingSpotReservedTime: z.string().optional(),
  standingSpotCancellationPolicy: z.string().optional(),
  standingSpotPausePolicy: z.string().optional(),
  standingSpotMissedClassPolicy: z.string().optional(),
  standingSpotMakeUpEligible: z.boolean().optional(),
  standingSpotComparableProductId: z.string().optional(),
  standingSpotAutoRenew: z.boolean().optional(),
  standingSpotMemberAttendanceProbabilityPct: z.number().min(0).max(100).optional(),
  standingSpotMemberReleasePolicy: z.string().optional(),
  standingSpotReleasedSeatResaleAllowed: z.boolean().optional(),
  standingSpotExpectedResaleProbabilityPct: z.number().min(0).max(100).optional(),
  standingSpotExpectedFlexibleFillProbabilityPct: z.number().min(0).max(100).optional(),
  /** Credit pack economics — legacy flat fields; prefer packRules when present */
  expectedRedemptionRatePct: z.number().min(0).max(100).optional(),
  expectedBreakagePct: z.number().min(0).max(100).optional(),
  /** @deprecated Use redemption behaviour from packRules, not monthly frequency */
  expectedMonthlyUsageCredits: z.number().min(0).optional(),
  renewalAssumptionPct: z.number().min(0).max(100).optional(),
  /** Flexible credit pack rules (quantity + validity architecture) */
  packRules: FlexiblePackRulesSchema.optional(),
  /** Standing Spot slot + commitment rules */
  standingSpotRules: StandingSpotRulesSchema.optional(),
  /** Standby economics */
  standbyExpectedAvailableEmptySeats: z.number().min(0).optional(),
  standbyExpectedClaimRatePct: z.number().min(0).max(100).optional(),
  standbyAttendanceRatePct: z.number().min(0).max(100).optional(),
  standbyRegularContributionPerSession: z.number().min(0).optional(),
  standbyReleaseHoursBefore: z.number().min(0).optional(),
  standbyCannibalisationPct: z.number().min(0).max(100).optional(),
  /** Private session economics — when type === private */
  privateRules: z
    .object({
      durationMinutes: z.number().int().positive().default(55),
      clientsPerSession: z.number().int().positive().default(1),
      reformersOccupied: z.number().int().positive().default(1),
      instructorCostPerHour: z.number().min(0).default(0),
      otherDirectVariableCost: z.number().min(0).default(0),
      eligibleTimeBands: z
        .array(z.enum(["peak", "standard", "off_peak"]))
        .default(["standard", "off_peak"]),
      expectedSessionsPerMonth: z.number().min(0).optional(),
      expectedCancellationRatePct: z.number().min(0).max(100).default(5),
      expectedNoShowRatePct: z.number().min(0).max(100).default(3),
    })
    .optional(),
  /**
   * Share of expected occupied service demand (Base Case planning mix).
   * Active drop_in, credit_pack, and private products must sum to 100%.
   * Alias: packageMixPct is kept in sync for flexible SKUs.
   */
  serviceDemandPct: z.number().min(0).max(100).optional(),
});

export const AccessProductMixSchema = z.object({
  /** Revenue mix methodology — seat-equivalent share of group access */
  flexiblePackPct: z.number().min(0).max(100).default(60),
  standingSpotPct: z.number().min(0).max(100).default(15),
  dropInPct: z.number().min(0).max(100).default(10),
  standbyPct: z.number().min(0).max(100).default(5),
  privateDuoPct: z.number().min(0).max(100).default(10),
  trialPct: z.number().min(0).max(100).default(0),
});

export type AccessProductMix = z.infer<typeof AccessProductMixSchema>;

export const DepreciationAssetSchema = z.object({
  id: z.string(),
  name: z.string(),
  purchaseValue: z.number().min(0),
  inServiceDate: z.string(),
  usefulLifeMonths: z.number().int().positive(),
  salvageValue: z.number().min(0).default(0),
  method: z.enum(["straight_line"]).default("straight_line"),
});

export const RampUpMonthSchema = z.object({
  month: z.number().int().min(1),
  occupancyPct: z.number().min(0).max(100),
});

/** Profit-backwards sales target — founder planning preferences */
export const SalesTargetPreferencesSchema = z.object({
  targetMonthlyNetProfit: z.number().min(0).default(200_000),
  targetMonth: z.number().int().min(1).max(36).default(8),
  solutionMode: z
    .enum(["balanced", "profit_maximising", "lowest_client_count"])
    .default("balanced"),
  salesMixMode: z.enum(["auto", "custom"]).default("auto"),
  /** productId → % of commercial sales count mix (custom mode) */
  customSalesMixPct: z.record(z.string(), z.number().min(0).max(100)).default({}),
  avgDropInPurchasesPerCustomerMonth: z.number().min(0.1).default(1.5),
  avgPrivateSessionsPerClientMonth: z.number().min(0.1).default(4),
  avgActivePacksPerPackCustomer: z.number().min(0.1).default(1),
  /** productId → expected renewal % for expiring pack holders */
  packRenewalRatePctByProductId: z.record(z.string(), z.number().min(0).max(100)).default({}),
  /** productId → existing active paying customers (planning estimate when no CRM data) */
  existingActiveClientsByProductId: z.record(z.string(), z.number().min(0)).default({}),
  /** Implied occupancy at or above this % → capacity status "tight" */
  capacityTightThresholdPct: z.number().min(0).max(100).default(85),
  /** Optional acquisition funnel — only used when provided */
  leadToQualifiedPct: z.number().min(0).max(100).optional(),
  qualifiedToPaidPct: z.number().min(0).max(100).optional(),
  leadToPaidPct: z.number().min(0).max(100).optional(),
  /** Manual sales mix quantities for explore mode (productId → count) */
  customSalesQuantitiesByProductId: z.record(z.string(), z.number().min(0)).default({}),
});

export type SalesTargetPreferences = z.infer<typeof SalesTargetPreferencesSchema>;

export const EscalationTypeSchema = z.enum([
  "annual_pct",
  "step_pct_interval",
  "fixed_amount",
  "none",
]);

export type EscalationType = z.infer<typeof EscalationTypeSchema>;

export const EscalationRuleBasisSchema = z.enum([
  "planning_default",
  "contract",
  "custom",
]);

export const CostEscalationRuleSchema = z.object({
  categoryId: z.string(),
  label: z.string(),
  escalationType: EscalationTypeSchema.default("annual_pct"),
  annualPct: z.number().min(-100).max(100).optional(),
  stepPct: z.number().min(0).max(100).optional(),
  stepIntervalMonths: z.number().int().positive().optional(),
  fixedStepAmount: z.number().min(0).optional(),
  firstEscalationMonth: z.number().int().min(1).default(13),
  ruleBasis: EscalationRuleBasisSchema.default("planning_default"),
  contractActive: z.boolean().default(false),
});

export type CostEscalationRule = z.infer<typeof CostEscalationRuleSchema>;

export const ProductPriceGrowthSchema = z.object({
  productId: z.string(),
  annualIncreasePct: z.number().min(0).max(100).default(0),
  firstIncreaseMonth: z.number().int().min(1).default(13),
});

export type ProductPriceGrowth = z.infer<typeof ProductPriceGrowthSchema>;

export const ScenarioTimelinePhaseSchema = z.object({
  id: z.string(),
  label: z.string(),
  startMonth: z.number().int().min(1),
  endMonth: z.number().int().min(1),
  /** Partial assumption overrides merged onto inherited base for this phase */
  assumptionOverrides: z.record(z.string(), z.unknown()).default({}),
});

export type ScenarioTimelinePhase = z.infer<typeof ScenarioTimelinePhaseSchema>;

export const CostEscalationPresetSchema = z.enum(["custom", "low", "base", "high"]);
export type CostEscalationPreset = z.infer<typeof CostEscalationPresetSchema>;

export const ForecastSettingsSchema = z.object({
  forecastYears: z.number().int().min(1).max(10).default(3),
  costEscalationPreset: CostEscalationPresetSchema.default("base"),
  costEscalations: z.array(CostEscalationRuleSchema).default([]),
  productPriceGrowth: z.array(ProductPriceGrowthSchema).default([]),
  /** Structural assumption changes by operating month — reformers, services, mix */
  forecastTimeline: z.array(ScenarioTimelinePhaseSchema).default([]),
});

export type ForecastSettings = z.infer<typeof ForecastSettingsSchema>;

export const FinanceAssumptionsSchema = z.object({
  id: z.string(),
  name: z.string().default("Live Assumptions"),
  isSample: z.boolean().default(true),
  updatedAt: z.string(),

  // General
  currency: z.string().default("INR"),
  financialYearStartMonth: z.number().int().min(1).max(12).default(4),
  gstRegistered: z.boolean().default(true),
  gstRatePct: z.number().min(0).max(100).default(18),
  /** @deprecated Always exclusive — product.price is net ex-GST */
  priceEntryMode: PriceEntryModeSchema.default("exclusive"),
  /** 2 = product.price is net sales ex-GST; 1 = legacy inclusive entry */
  pricingSemanticsVersion: z.number().int().default(2),

  // Studio
  reformers: z.number().int().positive().default(3),
  maxGroupClassSize: z.number().int().positive().default(3),
  operatingDaysPerWeek: z.number().int().min(1).max(7).default(6),
  weeksClosedPerYear: z.number().min(0).max(52).default(2),
  plannedHolidays: z.array(z.string()).default([]),

  // Schedule fallback
  classesPerDay: z.number().int().positive().default(5),
  useScheduleForCapacity: z.boolean().default(false),
  schedule: z.array(ClassScheduleEntrySchema).default([]),

  // Occupancy
  projectedBookedOccupancyPct: z.number().min(0).max(100).default(60),
  projectedAttendedOccupancyPct: z.number().min(0).max(100).default(55),
  cancellationRatePct: z.number().min(0).max(100).default(5),
  noShowRatePct: z.number().min(0).max(100).default(3),
  peakOccupancyPct: z.number().min(0).max(100).default(75),
  offPeakOccupancyPct: z.number().min(0).max(100).default(45),

  // Products
  products: z.array(ProductSchema).default([]),
  /** Expected revenue mix across access products (must sum to 100%) — derived from service demand mix when using simplified Base Case */
  accessProductMix: AccessProductMixSchema.optional(),

  /** Optional products — not part of the required 100% Base Case service demand mix */
  standingSpotEnabled: z.boolean().default(false),
  standbyEnabled: z.boolean().default(false),
  /** When true, Private blocks full studio capacity for the session slot */
  privateRequiresExclusiveStudio: z.boolean().default(false),

  // Personal training (legacy flat fields — synced from private Product when present)
  privateSessionsPerMonth: z.number().min(0).default(20),
  privatePrice: z.number().min(0).default(3000),
  privateDurationMinutes: z.number().int().positive().default(55),
  privateReformersOccupied: z.number().int().positive().default(1),
  privateInstructorCost: z.number().min(0).default(0),
  privateTimeSlot: z.string().optional(),
  duoSessionsPerMonth: z.number().min(0).default(10),
  duoPricePerPerson: z.number().min(0).default(2100),
  duoDurationMinutes: z.number().int().positive().default(55),
  duoReformersConsumed: z.number().int().positive().default(1),
  duoAvgPeople: z.number().min(1).default(2),
  workshopCountPerMonth: z.number().min(0).default(2),
  workshopPrice: z.number().min(0).default(2500),
  otherRevenuePerMonth: z.number().min(0).default(0),

  // Fixed operating expenses
  rent: z.number().min(0).default(90000),
  camMaintenance: z.number().min(0).default(10000),
  ownerInstructorSalary: z.number().min(0).default(60000),
  includeOwnerMarketRateComp: z.boolean().default(true),
  additionalInstructorSalary: z.number().min(0).default(0),
  cleanerSalary: z.number().min(0).default(15000),
  receptionSalary: z.number().min(0).default(0),
  security: z.number().min(0).default(5000),
  internet: z.number().min(0).default(2000),
  softwareSubscriptions: z.number().min(0).default(8000),
  accounting: z.number().min(0).default(5000),
  insurance: z.number().min(0).default(4000),
  fixedMarketingRetainer: z.number().min(0).default(10000),
  licences: z.number().min(0).default(2000),
  otherFixedCosts: z.number().min(0).default(5000),

  // Variable expenses
  electricityBase: z.number().min(0).default(8000),
  electricityVariablePerClass: z.number().min(0).default(50),
  laundry: z.number().min(0).default(6000),
  water: z.number().min(0).default(2000),
  cleaningSupplies: z.number().min(0).default(3000),
  sessionConsumables: z.number().min(0).default(30),
  refreshments: z.number().min(0).default(5000),
  paymentGatewayPct: z.number().min(0).max(100).default(2),
  paymentGatewayFixedFee: z.number().min(0).default(0),
  instructorPerClassPayout: z.number().min(0).default(0),
  instructorPerAttendeePayout: z.number().min(0).default(0),
  customerAcquisitionSpend: z.number().min(0).default(15000),
  repairsReserve: z.number().min(0).default(3000),
  miscVariableCosts: z.number().min(0).default(2000),
  customExpenses: z.array(CustomExpenseSchema).default([]),

  // Capex
  capexInteriorFitout: z.number().min(0).default(800000),
  capexReformers: z.number().min(0).default(450000),
  capexSmallEquipment: z.number().min(0).default(80000),
  capexMirrors: z.number().min(0).default(60000),
  capexFlooring: z.number().min(0).default(120000),
  capexLighting: z.number().min(0).default(50000),
  capexHvac: z.number().min(0).default(80000),
  capexSoundSystem: z.number().min(0).default(30000),
  capexFurniture: z.number().min(0).default(100000),
  capexReception: z.number().min(0).default(50000),
  capexChangingRoom: z.number().min(0).default(40000),
  capexBathroom: z.number().min(0).default(30000),
  capexSignage: z.number().min(0).default(25000),
  capexWebsite: z.number().min(0).default(50000),
  capexApp: z.number().min(0).default(0),
  capexProfessionalFees: z.number().min(0).default(75000),
  capexLicensingSetup: z.number().min(0).default(25000),
  capexLaunchMarketing: z.number().min(0).default(100000),
  capexInitialConsumables: z.number().min(0).default(20000),
  capexContingency: z.number().min(0).default(150000),
  capexOther: z.number().min(0).default(0),

  // Deposits
  securityDepositAmount: z.number().min(0).default(300000),
  securityDepositExpectedRefund: z.number().min(0).default(300000),
  securityDepositRefundDate: z.string().optional(),
  securityDepositImpairmentPct: z.number().min(0).max(100).default(0),

  // Financing
  founderEquity: z.number().min(0).default(3250000),
  loanAmount: z.number().min(0).default(0),
  loanInterestRatePct: z.number().min(0).default(12),
  loanTermMonths: z.number().int().positive().default(60),
  loanGracePeriodMonths: z.number().int().min(0).default(0),
  workingCapital: z.number().min(0).default(200000),

  // Tax & depreciation
  incomeTaxRatePct: z.number().min(0).max(100).default(25),
  depreciationAssets: z.array(DepreciationAssetSchema).default([]),
  creditBreakageRecognitionPct: z.number().min(0).max(100).default(0),

  // Ramp-up
  rampUpMode: z.enum(["manual", "interpolate"]).default("interpolate"),
  rampUpStartingOccupancyPct: z.number().min(0).max(100).default(30),
  rampUpTargetOccupancyPct: z.number().min(0).max(100).default(70),
  rampUpMonthsToTarget: z.number().int().positive().default(12),
  rampUpCurve: z.array(RampUpMonthSchema).default([]),

  // Credit liability
  creditsSoldOutstanding: z.number().int().min(0).default(0),
  creditsExpectedRedemptionBeforeExpiry: z.number().int().min(0).default(0),
  creditsExpectedToExpireUnused: z.number().int().min(0).default(0),
  peakSlotsShareOfCapacityPct: z.number().min(0).max(100).default(50),

  // Payback options
  includeRecoverableDepositInPayback: z.boolean().default(false),
  discountRatePct: z.number().min(0).default(10),

  /** Additional funding injections after launch — affects bank cash only */
  additionalFundingEvents: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["founder_equity", "loan", "grant", "other"]),
      amount: z.number().min(0),
      month: z.number().int().min(0).max(36).default(6),
      note: z.string().optional(),
    })
  ).default([]),

  // Target
  targetOpeningDate: z.string().optional(),

  /** Profit-backwards sales & client target preferences */
  salesTargetPreferences: SalesTargetPreferencesSchema.optional(),

  /** Multi-year forecast — cost escalation, price growth, horizon */
  forecastSettings: ForecastSettingsSchema.optional(),
});

export type FinanceAssumptions = z.infer<typeof FinanceAssumptionsSchema>;
export type FundingEvent = FinanceAssumptions["additionalFundingEvents"][number];
export type Product = z.infer<typeof ProductSchema>;
export type ClassScheduleEntry = z.infer<typeof ClassScheduleEntrySchema>;
export type DepreciationAsset = z.infer<typeof DepreciationAssetSchema>;

export const ScenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  assumptions: FinanceAssumptionsSchema,
  /** Scenario this was branched from (defaults to base case) */
  parentScenarioId: z.string().optional(),
  isBaseCase: z.boolean().default(false),
  timeline: z.array(ScenarioTimelinePhaseSchema).default([]),
  locked: z.boolean().default(false),
  archived: z.boolean().default(false),
  engineVersion: z.string().optional(),
  formulaVersion: z.string().optional(),
  /** Cached outputs at last save — auditable snapshot */
  storedOutputs: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Scenario = z.infer<typeof ScenarioSchema>;

export const SnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  notes: z.string().optional(),
  assumptions: FinanceAssumptionsSchema,
  outputs: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  immutable: z.boolean().default(true),
});

export type Snapshot = z.infer<typeof SnapshotSchema>;

export const DecisionSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
  decision: z.string(),
  reasoning: z.string().optional(),
  status: z.enum(["testing", "provisional", "locked", "reversed"]),
  category: z.string().optional(),
  relatedScenarioId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Decision = z.infer<typeof DecisionSchema>;

export const OpenQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  context: z.string().optional(),
  status: z.enum(["open", "resolved", "deferred"]).default("open"),
  createdAt: z.string(),
});

export type OpenQuestion = z.infer<typeof OpenQuestionSchema>;

export const NextActionSchema = z.object({
  id: z.string(),
  title: z.string(),
  dueDate: z.string().optional(),
  completed: z.boolean().default(false),
  link: z.string().optional(),
  createdAt: z.string(),
});

export type NextAction = z.infer<typeof NextActionSchema>;

export const StudioSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string().optional(),
  website: z.string().optional(),
  instagram: z.string().optional(),
  visited: z.boolean().default(false),
  visitDate: z.string().optional(),
  reformers: z.number().int().optional(),
  maxClassSize: z.number().int().optional(),
  instructorCount: z.number().int().optional(),
  classFormats: z.array(z.string()).default([]),
  dropInPrice: z.number().optional(),
  packPrices: z.record(z.string(), z.number()).default({}),
  privatePrice: z.number().optional(),
  introOffer: z.string().optional(),
  membership: z.string().optional(),
  cancellationPolicy: z.string().optional(),
  openingHours: z.string().optional(),
  bookingSystem: z.string().optional(),
  googleRating: z.number().optional(),
  personalRating: z.number().min(1).max(10).optional(),
  ratings: z.record(z.string(), z.number()).default({}),
  liked: z.string().optional(),
  disliked: z.string().optional(),
  exceptional: z.string().optional(),
  missing: z.string().optional(),
  ownCouldLearn: z.string().optional(),
  ownNeverCopy: z.string().optional(),
  targetCustomer: z.string().optional(),
  observedCrowd: z.string().optional(),
  howBusy: z.string().optional(),
  interestingDetails: z.string().optional(),
  pricingNotes: z.string().optional(),
  productGaps: z.string().optional(),
  notes: z.string().optional(),
  imageUrls: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Studio = z.infer<typeof StudioSchema>;

export const BrandItemSchema = z.object({
  id: z.string(),
  type: z.enum([
    "note",
    "idea",
    "reference",
    "image",
    "link",
    "document",
    "brand_principle",
    "naming_idea",
    "copy_phrase",
    "colour_reference",
    "typography_reference",
    "competitor_inspiration",
    "other",
  ]),
  title: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  sourceUrl: z.string().optional(),
  imageUrl: z.string().optional(),
  assetId: z.string().optional(),
  driveFileId: z.string().optional(),
  status: z.enum(["active", "archived"]).default("active"),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type BrandItem = z.infer<typeof BrandItemSchema>;

export const SpaceImageSchema = z.object({
  id: z.string(),
  board: z.string(),
  category: z.string().optional(),
  title: z.string().optional(),
  imageUrl: z.string().optional(),
  assetId: z.string().optional(),
  sourceUrl: z.string().optional(),
  mimeType: z.string().optional(),
  driveFileId: z.string().optional(),
  itemType: z.enum(["image", "link", "note", "document"]).default("image"),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  rating: z.enum(["love", "maybe", "reference"]).optional(),
  isSample: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export type SpaceImage = z.infer<typeof SpaceImageSchema>;

export const LibraryItemSchema = z.object({
  id: z.string(),
  type: z.enum([
    "idea",
    "link",
    "image",
    "note",
    "question",
    "task",
    "decision",
    "article",
    "vendor",
    "studio",
  ]),
  title: z.string(),
  content: z.string().optional(),
  url: z.string().optional(),
  imageUrl: z.string().optional(),
  assignedTo: z
    .enum([
      "math",
      "space",
      "studios",
      "programming",
      "product",
      "brand",
      "roadmap",
      "unassigned",
    ])
    .default("unassigned"),
  tags: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type LibraryItem = z.infer<typeof LibraryItemSchema>;

export const ROADMAP_PHASES = [
  "Research",
  "Financial validation",
  "Property",
  "Legal",
  "Build",
  "Brand",
  "Operations",
  "Pre-launch",
  "Launch",
] as const;

export const RoadmapItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  phase: z.string(),
  status: z.enum(["Todo", "In progress", "Done", "Blocked"]).default("Todo"),
  priority: z.enum(["High", "Medium", "Low"]).default("Medium"),
  owner: z.string().optional(),
  deadline: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type RoadmapItem = z.infer<typeof RoadmapItemSchema>;

export const ProductConceptSchema = z.object({
  id: z.string(),
  name: z.string(),
  problem: z.string(),
  priority: z.enum(["MVP", "Later", "Nice to have"]).default("MVP"),
  status: z.enum(["Idea", "Planned", "In progress", "Shipped", "Deprecated"]).default("Idea"),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProductConcept = z.infer<typeof ProductConceptSchema>;

/** Class / program catalog — linked to products in the financial model */
export const ProgrammingItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  classType: z
    .enum(["Group", "Private", "Standing Spot", "Standby", "Other"])
    .default("Group"),
  level: z.string().default("All levels"),
  status: z.enum(["Idea", "Testing", "Launch", "Live", "Archived"]).default("Idea"),
  credits: z.number().min(0).default(1),
  durationMinutes: z.number().int().positive().optional(),
  linkedProductId: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProgrammingItem = z.infer<typeof ProgrammingItemSchema>;
