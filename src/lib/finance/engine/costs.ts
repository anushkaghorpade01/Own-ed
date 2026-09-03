import { d, sum, trace, type CalculationTrace } from "../decimal";
import type { FinanceAssumptions } from "../schemas";
import Decimal from "decimal.js";
import { splitServiceDemandSpots } from "./service-demand-mix";
import {
  privateDirectVariableCostPerSession,
  privateSessionConsumables,
} from "./private-economics";

function sumCustomExpenses(
  assumptions: FinanceAssumptions,
  category: "fixed" | "variable"
): Decimal {
  return sum(
    (assumptions.customExpenses ?? [])
      .filter((e) => e.category === category)
      .map((e) => d(e.amount))
  );
}

export interface DirectCostsResult {
  variableInstructorPayouts: Decimal;
  sessionConsumables: Decimal;
  paymentFees: Decimal;
  directWorkshopCosts: Decimal;
  totalDirectCosts: Decimal;
  trace: CalculationTrace;
}

export function calculateDirectCosts(
  assumptions: FinanceAssumptions,
  attendedSeatsMonthly: Decimal,
  classesPerMonth: Decimal,
  grossBillings: Decimal
): DirectCostsResult {
  const split = splitServiceDemandSpots(assumptions, attendedSeatsMonthly);
  const groupAttended = split.groupSpots;
  const privateAttended = split.privateSpots;

  const perClassInstructor = d(assumptions.instructorPerClassPayout).times(
    classesPerMonth
  );
  const perAttendeeInstructor = d(assumptions.instructorPerAttendeePayout).times(
    groupAttended
  );
  const privateDirectPerSession = privateDirectVariableCostPerSession(assumptions);
  const privateConsumablesPerSession = privateSessionConsumables(assumptions);
  const privateInstructorPerSession = Decimal.max(
    0,
    privateDirectPerSession.minus(privateConsumablesPerSession)
  );
  const privateInstructor = privateAttended.times(privateInstructorPerSession);

  const variableInstructorPayouts = perClassInstructor
    .plus(perAttendeeInstructor)
    .plus(privateInstructor);

  const sessionConsumables = d(assumptions.sessionConsumables)
    .times(groupAttended)
    .plus(privateConsumablesPerSession.times(privateAttended));

  const paymentFees = grossBillings
    .times(d(assumptions.paymentGatewayPct).dividedBy(100))
    .plus(d(assumptions.paymentGatewayFixedFee).times(classesPerMonth));

  const directWorkshopCosts = new Decimal(0);
  const customVariable = sumCustomExpenses(assumptions, "variable");
  const totalDirectCosts = sum([
    variableInstructorPayouts,
    sessionConsumables,
    paymentFees,
    directWorkshopCosts,
    customVariable,
  ]);

  return {
    variableInstructorPayouts,
    sessionConsumables,
    paymentFees,
    directWorkshopCosts,
    totalDirectCosts,
    trace: trace(
      "Total direct costs",
      "Variable instructor + consumables + payment fees",
      "INR/month",
      [
        { label: "Instructor payouts", expression: variableInstructorPayouts.toString(), result: variableInstructorPayouts },
        { label: "Session consumables", expression: sessionConsumables.toString(), result: sessionConsumables },
        { label: "Payment fees", expression: paymentFees.toString(), result: paymentFees },
      ],
      totalDirectCosts,
    ),
  };
}

export interface OperatingExpensesResult {
  rent: Decimal;
  camMaintenance: Decimal;
  utilities: Decimal;
  ownerSalary: Decimal;
  instructorSalaries: Decimal;
  cleanerSalary: Decimal;
  receptionSalary: Decimal;
  security: Decimal;
  internet: Decimal;
  softwareSubscriptions: Decimal;
  accounting: Decimal;
  insurance: Decimal;
  marketing: Decimal;
  licences: Decimal;
  otherFixed: Decimal;
  laundry: Decimal;
  water: Decimal;
  cleaningSupplies: Decimal;
  refreshments: Decimal;
  customerAcquisition: Decimal;
  repairsReserve: Decimal;
  miscVariable: Decimal;
  totalOperatingExpenses: Decimal;
  totalFixedCosts: Decimal;
  trace: CalculationTrace;
}

export function calculateOperatingExpenses(
  assumptions: FinanceAssumptions,
  classesPerMonth: Decimal
): OperatingExpensesResult {
  const ownerSalary =
    assumptions.includeOwnerMarketRateComp
      ? d(assumptions.ownerInstructorSalary)
      : new Decimal(0);

  const utilities = d(assumptions.electricityBase).plus(
    d(assumptions.electricityVariablePerClass).times(classesPerMonth)
  );

  const marketing = d(assumptions.fixedMarketingRetainer).plus(
    assumptions.customerAcquisitionSpend
  );

  const customFixed = sumCustomExpenses(assumptions, "fixed");
  const customVariable = sumCustomExpenses(assumptions, "variable");

  const totalFixedCosts = sum([
    d(assumptions.rent),
    d(assumptions.camMaintenance),
    ownerSalary,
    d(assumptions.additionalInstructorSalary),
    d(assumptions.cleanerSalary),
    d(assumptions.receptionSalary),
    d(assumptions.security),
    d(assumptions.internet),
    d(assumptions.softwareSubscriptions),
    d(assumptions.accounting),
    d(assumptions.insurance),
    d(assumptions.licences),
    d(assumptions.otherFixedCosts),
    customFixed,
  ]);

  const totalOperatingExpenses = sum([
    d(assumptions.rent),
    d(assumptions.camMaintenance),
    utilities,
    ownerSalary,
    d(assumptions.additionalInstructorSalary),
    d(assumptions.cleanerSalary),
    d(assumptions.receptionSalary),
    d(assumptions.security),
    d(assumptions.internet),
    d(assumptions.softwareSubscriptions),
    d(assumptions.accounting),
    d(assumptions.insurance),
    marketing,
    d(assumptions.licences),
    d(assumptions.otherFixedCosts),
    d(assumptions.laundry),
    d(assumptions.water),
    d(assumptions.cleaningSupplies),
    d(assumptions.refreshments),
    d(assumptions.repairsReserve),
    d(assumptions.miscVariableCosts),
    customFixed,
    customVariable,
  ]);

  return {
    rent: d(assumptions.rent),
    camMaintenance: d(assumptions.camMaintenance),
    utilities,
    ownerSalary,
    instructorSalaries: d(assumptions.additionalInstructorSalary),
    cleanerSalary: d(assumptions.cleanerSalary),
    receptionSalary: d(assumptions.receptionSalary),
    security: d(assumptions.security),
    internet: d(assumptions.internet),
    softwareSubscriptions: d(assumptions.softwareSubscriptions),
    accounting: d(assumptions.accounting),
    insurance: d(assumptions.insurance),
    marketing,
    licences: d(assumptions.licences),
    otherFixed: d(assumptions.otherFixedCosts),
    laundry: d(assumptions.laundry),
    water: d(assumptions.water),
    cleaningSupplies: d(assumptions.cleaningSupplies),
    refreshments: d(assumptions.refreshments),
    customerAcquisition: d(assumptions.customerAcquisitionSpend),
    repairsReserve: d(assumptions.repairsReserve),
    miscVariable: d(assumptions.miscVariableCosts),
    totalOperatingExpenses,
    totalFixedCosts,
    trace: trace(
      "Total operating expenses",
      "Sum of all fixed and semi-variable operating costs",
      "INR/month",
      [{ label: "Total", expression: "Σ operating line items", result: totalOperatingExpenses }],
      totalOperatingExpenses
    ),
  };
}

export interface CapexResult {
  nonRecoverableCapex: Decimal;
  recoverableDeposits: Decimal;
  totalInitialInvestment: Decimal;
  breakdown: Array<{ name: string; amount: Decimal; recoverable: boolean }>;
}

export function calculateCapex(assumptions: FinanceAssumptions): CapexResult {
  const capexItems: Array<{ name: string; amount: Decimal; recoverable: boolean }> = [
    { name: "Interior fit-out", amount: d(assumptions.capexInteriorFitout), recoverable: false },
    { name: "Reformers", amount: d(assumptions.capexReformers), recoverable: false },
    { name: "Small equipment", amount: d(assumptions.capexSmallEquipment), recoverable: false },
    { name: "Mirrors", amount: d(assumptions.capexMirrors), recoverable: false },
    { name: "Flooring", amount: d(assumptions.capexFlooring), recoverable: false },
    { name: "Lighting", amount: d(assumptions.capexLighting), recoverable: false },
    { name: "HVAC", amount: d(assumptions.capexHvac), recoverable: false },
    { name: "Sound system", amount: d(assumptions.capexSoundSystem), recoverable: false },
    { name: "Furniture", amount: d(assumptions.capexFurniture), recoverable: false },
    { name: "Reception", amount: d(assumptions.capexReception), recoverable: false },
    { name: "Changing room", amount: d(assumptions.capexChangingRoom), recoverable: false },
    { name: "Bathroom", amount: d(assumptions.capexBathroom), recoverable: false },
    { name: "Signage", amount: d(assumptions.capexSignage), recoverable: false },
    { name: "Website", amount: d(assumptions.capexWebsite), recoverable: false },
    { name: "App", amount: d(assumptions.capexApp), recoverable: false },
    { name: "Professional fees", amount: d(assumptions.capexProfessionalFees), recoverable: false },
    { name: "Licensing setup", amount: d(assumptions.capexLicensingSetup), recoverable: false },
    { name: "Launch marketing", amount: d(assumptions.capexLaunchMarketing), recoverable: false },
    { name: "Initial consumables", amount: d(assumptions.capexInitialConsumables), recoverable: false },
    { name: "Contingency", amount: d(assumptions.capexContingency), recoverable: false },
    { name: "Other", amount: d(assumptions.capexOther), recoverable: false },
    {
      name: "Security deposit",
      amount: d(assumptions.securityDepositAmount),
      recoverable: true,
    },
  ];

  const nonRecoverableCapex = sum(
    capexItems.filter((i) => !i.recoverable).map((i) => i.amount)
  );
  const recoverableDeposits = sum(
    capexItems.filter((i) => i.recoverable).map((i) => i.amount)
  );

  return {
    nonRecoverableCapex,
    recoverableDeposits,
    totalInitialInvestment: nonRecoverableCapex.plus(recoverableDeposits).plus(
      d(assumptions.workingCapital)
    ),
    breakdown: capexItems,
  };
}

export function calculateDepreciation(
  assumptions: FinanceAssumptions
): Decimal {
  return sum(
    assumptions.depreciationAssets.map((asset) => {
      const depreciable = d(asset.purchaseValue).minus(asset.salvageValue);
      if (asset.usefulLifeMonths <= 0) return new Decimal(0);
      return depreciable.dividedBy(asset.usefulLifeMonths);
    })
  );
}

export function calculateLoanPayment(assumptions: FinanceAssumptions): Decimal {
  const principal = d(assumptions.loanAmount);
  if (principal.isZero() || assumptions.loanTermMonths <= 0) return new Decimal(0);

  const monthlyRate = d(assumptions.loanInterestRatePct)
    .dividedBy(100)
    .dividedBy(12);
  const n = assumptions.loanTermMonths;

  if (monthlyRate.isZero()) {
    return principal.dividedBy(n);
  }

  const onePlusR = d(1).plus(monthlyRate);
  const numerator = principal.times(monthlyRate).times(onePlusR.pow(n));
  const denominator = onePlusR.pow(n).minus(1);
  return numerator.dividedBy(denominator);
}

export function calculateLoanInterest(
  assumptions: FinanceAssumptions,
  remainingPrincipal?: Decimal
): Decimal {
  const principal = remainingPrincipal ?? d(assumptions.loanAmount);
  return principal
    .times(d(assumptions.loanInterestRatePct).dividedBy(100))
    .dividedBy(12);
}
