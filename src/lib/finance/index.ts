export { runFinanceModel, type FinanceModelOutput } from "./run-model";
import { runFinanceModel, type FinanceModelOutput } from "./run-model";
import { calculateWeightedRealisedRevenue } from "./engine/revenue";
import { getRampUpOccupancy } from "./engine/cash-flow";
import { sensitivityMatrix } from "./engine/break-even";
import type { FinanceAssumptions } from "./schemas";
import Decimal from "decimal.js";

export function runScenarioComparison(
  scenarios: FinanceAssumptions[]
): Array<FinanceModelOutput["summary"] & { name: string }> {
  return scenarios.map((assumptions) => {
    const model = runFinanceModel(assumptions);
    return {
      name: assumptions.name,
      ...model.summary,
    };
  });
}

export function runSensitivity(
  baseAssumptions: FinanceAssumptions,
  occupancyRows: number[],
  priceColumns: number[]
): Decimal[][] {
  return sensitivityMatrix(
    baseAssumptions,
    (occPct, netPrice) => {
      const modified = {
        ...baseAssumptions,
        projectedBookedOccupancyPct: occPct,
        products: baseAssumptions.products.map((p) => {
          if (p.type !== "drop_in") return p;
          return { ...p, price: Math.round(netPrice) };
        }),
      };
      return runFinanceModel(modified).pl.ebitda;
    },
    occupancyRows,
    priceColumns
  );
}

export { calculateWeightedRealisedRevenue, getRampUpOccupancy };
export { calculateAccessProducts, ACCESS_PRODUCT_FORMULAS } from "./engine/access-products";
export {
  analyzeFlexiblePack,
  analyzeFlexiblePackPortfolio,
  listFlexiblePacks,
  expectedCreditsRedeemedInMonth,
  runValidityStressTest,
  estimateSafePackSales,
  FLEXIBLE_PACK_FORMULAS,
} from "./engine/flexible-packs";
export { buildCreditLedgerFromAssumptions, deriveOutstandingCredits } from "./engine/credit-ledger";
export { calculateCreditHealth } from "./engine/credit-health";
export { migrateLegacyProducts } from "./engine/product-migration";
export {
  getActiveProducts,
  getFlexibleCreditProducts,
  previewProductChangeImpact,
  describeProductChange,
  isFinanciallyMeaningfulChange,
  traceProductMixContribution,
  ensureProductVersionFields,
  snapshotProduct,
  createBlankFlexibleProduct,
  type ProductInput,
} from "./engine/product-catalog";
export * from "./engine/scenarios";
export * from "./engine/optimisation";
export * from "./engine/sales-client-target";
export * from "./business-insights";
export * from "./decimal";
export * from "./schemas";
export * from "./validation";
