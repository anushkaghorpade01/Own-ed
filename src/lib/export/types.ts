import type Decimal from "decimal.js";
import type { FinanceAssumptions, Scenario } from "@/lib/finance/schemas";
import type { FinanceModelOutput } from "@/lib/finance/run-model";
import type { SalesTargetSolution, ImpliedDeliveryMixRow } from "@/lib/finance/engine/sales-client-target";
import type { HealthCheckResult } from "@/lib/ask-owned/health-checks";
import type { ScenarioDetailMetrics } from "@/lib/finance/engine/scenarios";

export type ExportValueType =
  | "FOUNDER INPUT"
  | "CALCULATED"
  | "CONTRACT / ACTUAL"
  | "PLANNING DEFAULT";

export type ExportMode = "full" | "quick" | "csv";

export interface FinancialExportMetadata {
  scenarioName: string;
  selectedMonth: number;
  exportDate: string;
  engineVersion: string;
  formulaVersion: string;
  assumptionsUpdatedAt?: string;
  studioName?: string;
}

export interface AssumptionExportRow {
  category: string;
  assumption: string;
  value: string | number;
  unit: string;
  type: ExportValueType;
  source: string;
  notes?: string;
}

export interface ProductPricingExportRow {
  product: string;
  productType: string;
  credits: number;
  validity: string;
  netSalesPrice: number;
  netPerCreditOrSession: number;
  gstRate: string;
  customerPriceIncGst: number;
  directCostPerDelivery: number;
  contributionPerBooking: number;
  contributionMarginPct: number;
  active: boolean;
}

export interface ServiceMixExportSection {
  forecastMix: Array<{ service: string; bookingMixPct: number }>;
  salesPlan: Array<{ product: string; quantitySold: number; netSales: number }>;
  capacity: {
    creditsCreated: number;
    expectedDeliveryDemand: number;
    existingOutstandingDemand: number;
    availableCapacity: number;
    impliedOccupancyPct: number;
    status: string;
  };
  impliedDeliveryMix: ImpliedDeliveryMixRow[];
}

export interface ModelCheckExportRow {
  check: string;
  status: "PASS" | "FAIL" | "WARNING";
  expected: string;
  actual: string;
  detail?: string;
}

export interface FinancialExportModel {
  metadata: FinancialExportMetadata;
  assumptions: FinanceAssumptions;
  model: FinanceModelOutput;
  salesTarget: {
    targetMonth: number;
    targetProfit: number;
    forecastProfit: number;
    gapOrSurplus: number;
    forecastQuantities: Record<string, number>;
    planQuantities: Record<string, number>;
    forecastSolution: SalesTargetSolution;
    planSolution: SalesTargetSolution;
  };
  serviceMix: ServiceMixExportSection;
  scenarios: Array<{ name: string; metrics: ScenarioDetailMetrics }>;
  healthChecks: HealthCheckResult[];
  validationMessages: string[];
}

export interface BuildExportModelInput {
  assumptions: FinanceAssumptions;
  scenarios?: Scenario[];
  selectedMonth?: number;
}
