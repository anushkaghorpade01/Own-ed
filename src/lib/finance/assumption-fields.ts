/** Central registry of FinanceAssumptions fields for UI editors */

export const CAPEX_FIELDS: Array<{ key: string; label: string }> = [
  { key: "capexInteriorFitout", label: "Interior fit-out" },
  { key: "capexReformers", label: "Reformers & equipment" },
  { key: "capexSmallEquipment", label: "Small equipment" },
  { key: "capexMirrors", label: "Mirrors" },
  { key: "capexFlooring", label: "Flooring" },
  { key: "capexLighting", label: "Lighting" },
  { key: "capexHvac", label: "HVAC" },
  { key: "capexSoundSystem", label: "Sound system" },
  { key: "capexFurniture", label: "Furniture" },
  { key: "capexReception", label: "Reception" },
  { key: "capexChangingRoom", label: "Changing room" },
  { key: "capexBathroom", label: "Bathroom" },
  { key: "capexSignage", label: "Signage" },
  { key: "capexWebsite", label: "Website" },
  { key: "capexApp", label: "App / software build" },
  { key: "capexProfessionalFees", label: "Professional fees" },
  { key: "capexLicensingSetup", label: "Licensing & setup" },
  { key: "capexLaunchMarketing", label: "Launch marketing (one-off)" },
  { key: "capexInitialConsumables", label: "Initial consumables" },
  { key: "capexContingency", label: "Contingency" },
  { key: "capexOther", label: "Other capex" },
];

export const FINANCING_FIELDS: Array<{ key: string; label: string; suffix?: string }> = [
  { key: "founderEquity", label: "Founder funding planned (your money)", suffix: "₹" },
  { key: "loanAmount", label: "Loan principal", suffix: "₹" },
  { key: "loanInterestRatePct", label: "Loan interest rate", suffix: "% p.a." },
  { key: "loanTermMonths", label: "Loan term", suffix: "months" },
  { key: "loanGracePeriodMonths", label: "Loan grace period", suffix: "months" },
];

export const DEPOSIT_FIELDS: Array<{ key: string; label: string; suffix?: string }> = [
  { key: "securityDepositAmount", label: "Security deposit paid", suffix: "₹" },
  { key: "securityDepositExpectedRefund", label: "Expected refund amount", suffix: "₹" },
  { key: "securityDepositImpairmentPct", label: "Impairment risk", suffix: "%" },
];

export const ANCILLARY_REVENUE_FIELDS: Array<{ key: string; label: string; suffix?: string }> = [
  { key: "privatePrice", label: "Private session price", suffix: "₹" },
  { key: "duoPricePerPerson", label: "Duo price per person", suffix: "₹" },
  { key: "duoAvgPeople", label: "Duo avg people per session", suffix: "people" },
  { key: "workshopPrice", label: "Workshop price", suffix: "₹" },
  { key: "workshopCountPerMonth", label: "Workshops per month", suffix: "count" },
  { key: "otherRevenuePerMonth", label: "Other revenue", suffix: "₹/mo" },
];

export const TAX_FIELDS: Array<{ key: string; label: string; suffix?: string }> = [
  { key: "incomeTaxRatePct", label: "Income tax rate", suffix: "%" },
  { key: "creditBreakageRecognitionPct", label: "Breakage recognition", suffix: "%" },
];

export const CREDIT_LIABILITY_FIELDS: Array<{ key: string; label: string; suffix?: string }> = [
  { key: "creditsSoldOutstanding", label: "Credits sold outstanding", suffix: "credits" },
  { key: "creditsExpectedRedemptionBeforeExpiry", label: "Expected redemption before expiry", suffix: "credits" },
  { key: "creditsExpectedToExpireUnused", label: "Expected to expire unused", suffix: "credits" },
  { key: "peakSlotsShareOfCapacityPct", label: "Peak slots share of capacity", suffix: "%" },
];
