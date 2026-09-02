import { runFinanceModel } from "@/lib/finance/run-model";
import { validateAssumptions } from "@/lib/finance/validation";
import { runOwnedHealthChecks } from "@/lib/ask-owned/health-checks";
import { detectConstraintWarnings } from "@/lib/finance/engine/scenarios";
import { analyzeScenario, ENGINE_VERSION, FORMULA_VERSION } from "@/lib/finance/engine/scenarios";
import {
  runSalesTargetAnalysis,
  evaluateSalesPlan,
  getCoreSalesProducts,
  buildServiceDemandMixPct,
  calculateImpliedDeliveryMix,
  forecastSalesByProduct,
} from "@/lib/finance/engine/sales-client-target";
import { SalesTargetPreferencesSchema } from "@/lib/finance/schemas";
import type { BuildExportModelInput, FinancialExportModel } from "./types";
import { exportNum } from "./decimal";

export function buildFinancialExportModel(input: BuildExportModelInput): FinancialExportModel {
  const assumptions = input.assumptions;
  const prefs = SalesTargetPreferencesSchema.parse(assumptions.salesTargetPreferences ?? {});
  const selectedMonth = input.selectedMonth ?? prefs.targetMonth;
  const model = runFinanceModel(assumptions);

  const analysis = runSalesTargetAnalysis(assumptions, {
    targetMonthlyNetProfit: prefs.targetMonthlyNetProfit,
    targetMonth: selectedMonth,
  });

  const products = getCoreSalesProducts(assumptions);
  const planQuantities =
    prefs.customSalesQuantitiesByProductId ??
    Object.fromEntries(products.map((p) => [p.id, 0]));
  const forecastQuantities = forecastSalesByProduct(assumptions);

  const planSolution = evaluateSalesPlan(
    assumptions,
    planQuantities,
    selectedMonth,
    prefs.targetMonthlyNetProfit
  );
  const forecastSolution = evaluateSalesPlan(
    assumptions,
    forecastQuantities,
    selectedMonth,
    prefs.targetMonthlyNetProfit
  );

  const mixPct = buildServiceDemandMixPct(assumptions);
  const impliedMix = calculateImpliedDeliveryMix(planSolution);

  const scenarios = (input.scenarios ?? [])
    .filter((s) => !s.archived)
    .map((s) => ({
      name: s.name,
      metrics: analyzeScenario(s.assumptions).metrics,
    }));

  const healthChecks = runOwnedHealthChecks(model);
  const constraintWarnings = detectConstraintWarnings(model);
  for (const w of constraintWarnings) {
    if (w.severity === "critical" || w.severity === "warning") {
      healthChecks.push({
        id: `constraint-${w.title}`,
        label: w.title,
        passed: false,
        expected: "No constraint warning",
        actual: w.explanation,
        note: w.severity.toUpperCase(),
      });
    }
  }

  const validationErrors = validateAssumptions(assumptions);
  const validationMessages = validationErrors.map((e) => `${e.field}: ${e.message}`);

  const gapOrSurplus =
    exportNum(analysis.forecastProfit)! - prefs.targetMonthlyNetProfit;

  return {
    metadata: {
      scenarioName: assumptions.name ?? "Base",
      selectedMonth,
      exportDate: new Date().toISOString(),
      engineVersion: ENGINE_VERSION,
      formulaVersion: FORMULA_VERSION,
      assumptionsUpdatedAt: assumptions.updatedAt,
      studioName: assumptions.name,
    },
    assumptions,
    model,
    salesTarget: {
      targetMonth: selectedMonth,
      targetProfit: prefs.targetMonthlyNetProfit,
      forecastProfit: exportNum(analysis.forecastProfit)!,
      gapOrSurplus,
      forecastQuantities,
      planQuantities,
      forecastSolution,
      planSolution,
    },
    serviceMix: {
      forecastMix: products.map((p) => ({
        service: p.name,
        bookingMixPct: mixPct[p.id] ?? 0,
      })),
      salesPlan: planSolution.productRows.map((r) => ({
        product: r.productName,
        quantitySold: r.sales,
        netSales: exportNum(r.netSales)!,
      })),
      capacity: {
        creditsCreated: exportNum(planSolution.delivery.creditsSold)!,
        expectedDeliveryDemand: exportNum(planSolution.delivery.totalReformerDemand)!,
        existingOutstandingDemand: exportNum(
          planSolution.delivery.expectedRedemptionsFromExistingCredits
        )!,
        availableCapacity: exportNum(planSolution.delivery.availableReformerSpots)!,
        impliedOccupancyPct: exportNum(planSolution.delivery.impliedOccupancyPct)!,
        status: planSolution.delivery.capacityStatus,
      },
      impliedDeliveryMix: impliedMix,
    },
    scenarios,
    healthChecks,
    validationMessages,
  };
}

export function validateExportModel(model: FinancialExportModel): {
  blocking: string[];
  warnings: string[];
} {
  const blocking: string[] = [];
  const warnings: string[] = [];

  if (!Number.isFinite(model.salesTarget.forecastProfit)) {
    blocking.push("Forecast profit is not a valid number.");
  }

  for (const check of model.healthChecks) {
    if (check.passed) continue;
    const detail = check.actual ?? check.note ?? "";
    if (check.id.startsWith("constraint-")) {
      warnings.push(`${check.label}. ${detail}`.trim());
      continue;
    }
    warnings.push(
      `${check.label}${check.expected ? ` (expected ${check.expected}, actual ${check.actual ?? "—"})` : ""}`
    );
  }

  for (const msg of model.validationMessages) {
    warnings.push(msg);
  }

  return { blocking, warnings };
}

export function buildExportFilename(model: FinancialExportModel, mode: "full" | "quick"): string {
  const date = model.metadata.exportDate.slice(0, 10);
  const scenario = model.metadata.scenarioName.replace(/[^a-zA-Z0-9_-]+/g, "_");
  const month = model.metadata.selectedMonth;
  const kind = mode === "quick" ? "Summary" : "Financial_Model";
  return `OWNED_${kind}_${scenario}_Month${month}_${date}.xlsx`;
}
