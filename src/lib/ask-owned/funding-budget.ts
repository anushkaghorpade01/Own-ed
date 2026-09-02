import type { FinanceAssumptions } from "@/lib/finance/schemas";
import { runFinanceModel } from "@/lib/finance/run-model";

/** Assumption fields that feed calculateOperatingExpenses — scaled together for budget solver */
const OPEX_NUMERIC_KEYS = [
  "rent",
  "camMaintenance",
  "ownerInstructorSalary",
  "additionalInstructorSalary",
  "cleanerSalary",
  "receptionSalary",
  "security",
  "internet",
  "softwareSubscriptions",
  "accounting",
  "insurance",
  "fixedMarketingRetainer",
  "licences",
  "otherFixedCosts",
  "electricityBase",
  "electricityVariablePerClass",
  "laundry",
  "water",
  "cleaningSupplies",
  "refreshments",
  "customerAcquisitionSpend",
  "repairsReserve",
  "miscVariableCosts",
] as const;

export function scaleOperatingExpenses(
  assumptions: FinanceAssumptions,
  scale: number
): FinanceAssumptions {
  const s = Math.max(0, Math.min(1, scale));
  const next = { ...assumptions } as FinanceAssumptions;

  for (const key of OPEX_NUMERIC_KEYS) {
    const val = assumptions[key];
    if (typeof val === "number") {
      switch (key) {
        case "rent":
          next.rent = Math.round(val * s);
          break;
        case "camMaintenance":
          next.camMaintenance = Math.round(val * s);
          break;
        case "ownerInstructorSalary":
          next.ownerInstructorSalary = Math.round(val * s);
          break;
        case "additionalInstructorSalary":
          next.additionalInstructorSalary = Math.round(val * s);
          break;
        case "cleanerSalary":
          next.cleanerSalary = Math.round(val * s);
          break;
        case "receptionSalary":
          next.receptionSalary = Math.round(val * s);
          break;
        case "security":
          next.security = Math.round(val * s);
          break;
        case "internet":
          next.internet = Math.round(val * s);
          break;
        case "softwareSubscriptions":
          next.softwareSubscriptions = Math.round(val * s);
          break;
        case "accounting":
          next.accounting = Math.round(val * s);
          break;
        case "insurance":
          next.insurance = Math.round(val * s);
          break;
        case "fixedMarketingRetainer":
          next.fixedMarketingRetainer = Math.round(val * s);
          break;
        case "licences":
          next.licences = Math.round(val * s);
          break;
        case "otherFixedCosts":
          next.otherFixedCosts = Math.round(val * s);
          break;
        case "electricityBase":
          next.electricityBase = Math.round(val * s);
          break;
        case "electricityVariablePerClass":
          next.electricityVariablePerClass = Math.round(val * s);
          break;
        case "laundry":
          next.laundry = Math.round(val * s);
          break;
        case "water":
          next.water = Math.round(val * s);
          break;
        case "cleaningSupplies":
          next.cleaningSupplies = Math.round(val * s);
          break;
        case "refreshments":
          next.refreshments = Math.round(val * s);
          break;
        case "customerAcquisitionSpend":
          next.customerAcquisitionSpend = Math.round(val * s);
          break;
        case "repairsReserve":
          next.repairsReserve = Math.round(val * s);
          break;
        case "miscVariableCosts":
          next.miscVariableCosts = Math.round(val * s);
          break;
      }
    }
  }

  if (assumptions.customExpenses?.length) {
    next.customExpenses = assumptions.customExpenses.map((e) => ({
      ...e,
      amount: Math.round(e.amount * s),
    }));
  }

  return next;
}

export interface FundingBudgetResult {
  budget: number;
  onlyFounder: boolean;
  targetMonth: number;
  baselineGap: number;
  baselineLowestCash: number;
  baselineMinRequired: number;
  requiredScale: number | null;
  requiredMonthlyCut: number;
  requiredMonthlyOpexAfter: number;
  currentMonthlyOpex: number;
  cutPct: number;
  feasible: boolean;
  solvedModel: ReturnType<typeof runFinanceModel> | null;
  bankCashPositiveMonth: number | null;
  operatingCashPositiveMonth: number | null;
}

export function solveFundingBudget(
  assumptions: FinanceAssumptions,
  budget: number,
  onlyFounder: boolean,
  targetMonth: number
): FundingBudgetResult {
  const basePatch: FinanceAssumptions = {
    ...assumptions,
    founderEquity: budget,
    loanAmount: onlyFounder ? 0 : assumptions.loanAmount,
    additionalFundingEvents: onlyFounder ? [] : assumptions.additionalFundingEvents ?? [],
  };

  const baselineModel = runFinanceModel(basePatch);
  const baselineHealth = baselineModel.cashFlow.cashHealth;
  const currentOpex = baselineModel.pl.operatingExpenses.toNumber();

  const baselineGap = baselineHealth.fundingGap.toNumber();
  const baselineLowest = baselineHealth.lowestBankCash.toNumber();

  if (baselineGap <= 0) {
    return {
      budget,
      onlyFounder,
      targetMonth,
      baselineGap,
      baselineLowestCash: baselineLowest,
      baselineMinRequired: baselineHealth.minimumTotalFundingRequired.toNumber(),
      requiredScale: 1,
      requiredMonthlyCut: 0,
      requiredMonthlyOpexAfter: currentOpex,
      currentMonthlyOpex: currentOpex,
      cutPct: 0,
      feasible: true,
      solvedModel: baselineModel,
      bankCashPositiveMonth: baselineHealth.bankCashPositiveMonth,
      operatingCashPositiveMonth: baselineHealth.operatingCashPositiveMonth,
    };
  }

  let lo = 0;
  let hi = 1;
  let bestModel: ReturnType<typeof runFinanceModel> | null = null;

  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    const scaled = scaleOperatingExpenses(basePatch, mid);
    const model = runFinanceModel(scaled);
    const gap = model.cashFlow.cashHealth.fundingGap.toNumber();

    if (gap <= 0) {
      hi = mid;
      bestModel = model;
    } else {
      lo = mid;
    }
  }

  const atZero = runFinanceModel(scaleOperatingExpenses(basePatch, 0));
  const zeroGap = atZero.cashFlow.cashHealth.fundingGap.toNumber();

  if (zeroGap > 0) {
    return {
      budget,
      onlyFounder,
      targetMonth,
      baselineGap,
      baselineLowestCash: baselineLowest,
      baselineMinRequired: baselineHealth.minimumTotalFundingRequired.toNumber(),
      requiredScale: null,
      requiredMonthlyCut: currentOpex,
      requiredMonthlyOpexAfter: 0,
      currentMonthlyOpex: currentOpex,
      cutPct: 100,
      feasible: false,
      solvedModel: null,
      bankCashPositiveMonth: baselineHealth.bankCashPositiveMonth,
      operatingCashPositiveMonth: baselineHealth.operatingCashPositiveMonth,
    };
  }

  const solved = bestModel ?? runFinanceModel(scaleOperatingExpenses(basePatch, hi));
  const afterOpex = solved.pl.operatingExpenses.toNumber();
  const cut = Math.max(0, currentOpex - afterOpex);
  const cutPct = currentOpex > 0 ? (cut / currentOpex) * 100 : 0;

  return {
    budget,
    onlyFounder,
    targetMonth,
    baselineGap,
    baselineLowestCash: baselineLowest,
    baselineMinRequired: baselineHealth.minimumTotalFundingRequired.toNumber(),
    requiredScale: hi,
    requiredMonthlyCut: cut,
    requiredMonthlyOpexAfter: afterOpex,
    currentMonthlyOpex: currentOpex,
    cutPct,
    feasible: true,
    solvedModel: solved,
    bankCashPositiveMonth: solved.cashFlow.cashHealth.bankCashPositiveMonth,
    operatingCashPositiveMonth: solved.cashFlow.cashHealth.operatingCashPositiveMonth,
  };
}
