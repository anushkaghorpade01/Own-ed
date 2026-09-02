/**
 * Sales & Client Target — profit-backwards commercial planning engine.
 *
 * PROFIT TARGET → REQUIRED SALES → DELIVERY DEMAND → CAPACITY FEASIBILITY
 *
 * Commercial P&L uses canonical pack/private economics + calculatePL.
 * Occupancy is an output, not an input.
 */
import Decimal from "decimal.js";
import { d, WEEKS_PER_MONTH, trace, type CalculationTrace } from "../decimal";
import type { FinanceAssumptions, Product, SalesTargetPreferences } from "../schemas";
import { SalesTargetPreferencesSchema } from "../schemas";
import {
  analyzeFlexiblePack,
  expectedCreditsRedeemedInMonth,
  listFlexiblePacks,
  resolvePackRules,
} from "./flexible-packs";
import { privateContributionPerSession, privateDirectVariableCostPerSession } from "./private-economics";
import { productNetPrice } from "./product-pricing";
import { getPrivateProduct, listBaseCaseMixProducts } from "./service-demand-mix";
import { calculateCapacity } from "./capacity";
import { calculateOperatingExpenses } from "./costs";
import { calculatePL } from "./pl";
import { runFinanceModel } from "../run-model";
import { getRampUpOccupancy } from "./cash-flow";

export const SALES_TARGET_ENGINE_VERSION = "1.0.0";

export type SalesSolutionMode = SalesTargetPreferences["solutionMode"];
export type SalesMixMode = SalesTargetPreferences["salesMixMode"];
export type CapacityStatus = "feasible" | "tight" | "not_feasible";

export interface ProductSaleQuantity {
  productId: string;
  productName: string;
  productType: Product["type"];
  quantity: number;
}

export interface ProductCommercialRow {
  productId: string;
  productName: string;
  productType: Product["type"];
  sales: number;
  netSales: Decimal;
  directCost: Decimal;
  contribution: Decimal;
  contributionPct: Decimal;
  contributionPerSale: Decimal;
  netSalesPerSale: Decimal;
  creditsSold: Decimal;
  expectedRedemptionsThisMonth: Decimal;
  trace?: CalculationTrace;
}

export interface DeliveryFeasibility {
  creditsSold: Decimal;
  expectedRedemptionsFromNewSales: Decimal;
  expectedRedemptionsFromExistingCredits: Decimal;
  privateBookings: Decimal;
  totalReformerDemand: Decimal;
  availableReformerSpots: Decimal;
  impliedOccupancyPct: Decimal;
  remainingCapacity: Decimal;
  capacityStatus: CapacityStatus;
  peakTimeWarning?: string;
  futureMonthWarnings: string[];
}

export interface ClientRequirement {
  packHoldersRequired: Record<string, number>;
  dropInPurchasesRequired: number;
  privateSessionsRequired: number;
  estimatedUniqueActiveClients: Decimal;
  newSalesRequired: Record<string, number>;
  renewingFromExisting: Record<string, number>;
  totalActiveByProduct: Record<string, number>;
  newCustomersNeededThisMonth: Decimal;
  isPlanningEstimate: boolean;
}

export interface AcquisitionFunnel {
  newPayingClientsRequired: number;
  qualifiedLeadsRequired?: number;
  enquiriesRequired?: number;
  steps: string[];
}

export interface SalesTargetSolution {
  mode: SalesSolutionMode;
  quantities: ProductSaleQuantity[];
  netSales: Decimal;
  directCosts: Decimal;
  operatingExpenses: Decimal;
  planningNetProfit: Decimal;
  surplusToTarget: Decimal;
  productRows: ProductCommercialRow[];
  delivery: DeliveryFeasibility;
  clients: ClientRequirement;
}

export interface SalesTargetAnalysis {
  preferences: SalesTargetPreferences;
  targetMonth: number;
  targetProfit: Decimal;
  forecastProfit: Decimal;
  profitGap: Decimal;
  solutions: SalesTargetSolution[];
  primarySolution: SalesTargetSolution;
  requiredVsForecast?: Array<{
    productId: string;
    productName: string;
    required: number;
    forecast: number;
    gap: number;
  }>;
  engineVersion: string;
}

export interface ProductCommercialEconomics {
  product: Product;
  netSalesPerSale: Decimal;
  directCostPerSale: Decimal;
  contributionPerSale: Decimal;
  creditsPerSale: number;
  reformerDemandPerSaleThisMonth: Decimal;
}

function resolvePreferences(assumptions: FinanceAssumptions): SalesTargetPreferences {
  return SalesTargetPreferencesSchema.parse(assumptions.salesTargetPreferences ?? {});
}

function assumptionsForMonth(
  assumptions: FinanceAssumptions,
  month: number
): FinanceAssumptions {
  const occupancyPct = getRampUpOccupancy(assumptions, month).times(100).toNumber();
  return {
    ...assumptions,
    projectedBookedOccupancyPct: occupancyPct,
  };
}

/** Core commercial products for the sales target solver (excludes standing/standby). */
export function getCoreSalesProducts(assumptions: FinanceAssumptions): Product[] {
  const base = listBaseCaseMixProducts(assumptions);
  const flex = listFlexiblePacks(assumptions);
  const privateProduct = getPrivateProduct(assumptions);
  const ids = new Set<string>();
  const out: Product[] = [];
  for (const p of [...flex, ...base.filter((b) => b.type === "private")]) {
    if (ids.has(p.id)) continue;
    ids.add(p.id);
    out.push(p);
  }
  if (privateProduct && !ids.has(privateProduct.id)) {
    out.push(privateProduct);
  }
  return out.sort((a, b) => {
    const order = (t: string) =>
      t === "drop_in" ? 0 : t === "credit_pack" ? 1 : t === "private" ? 2 : 3;
    return order(a.type) - order(b.type) || a.name.localeCompare(b.name);
  });
}

export function computeProductCommercialEconomics(
  product: Product,
  assumptions: FinanceAssumptions
): ProductCommercialEconomics {
  if (product.type === "private") {
    const net = productNetPrice(product, assumptions);
    const direct = privateDirectVariableCostPerSession(assumptions, product);
    const contribution = privateContributionPerSession(assumptions);
    return {
      product,
      netSalesPerSale: net,
      directCostPerSale: direct,
      contributionPerSale: contribution,
      creditsPerSale: 0,
      reformerDemandPerSaleThisMonth: d(1),
    };
  }

  const econ = analyzeFlexiblePack(product, assumptions);
  const credits = product.creditsIncluded || 1;
  const reformerThisMonth = expectedCreditsRedeemedInMonth(product, assumptions, 1, 0);

  return {
    product,
    netSalesPerSale: econ.netPackageValue,
    directCostPerSale: econ.expectedVariableCost,
    contributionPerSale: econ.expectedContribution,
    creditsPerSale: credits,
    reformerDemandPerSaleThisMonth: reformerThisMonth,
  };
}

function quantitiesToRecord(quantities: ProductSaleQuantity[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const q of quantities) {
    map[q.productId] = q.quantity;
  }
  return map;
}

function recordToQuantities(
  record: Record<string, number>,
  products: Product[]
): ProductSaleQuantity[] {
  return products.map((p) => ({
    productId: p.id,
    productName: p.name,
    productType: p.type,
    quantity: Math.max(0, Math.floor(record[p.id] ?? 0)),
  }));
}

export function calculateCommercialTotals(
  assumptions: FinanceAssumptions,
  quantities: Record<string, number>
): { netSales: Decimal; directCosts: Decimal; rows: ProductCommercialRow[] } {
  const products = getCoreSalesProducts(assumptions);
  const rows: ProductCommercialRow[] = [];
  let netSales = new Decimal(0);
  let directCosts = new Decimal(0);

  for (const product of products) {
    const qty = Math.max(0, Math.floor(quantities[product.id] ?? 0));
    if (qty === 0) continue;

    const econ = computeProductCommercialEconomics(product, assumptions);
    const rowNet = econ.netSalesPerSale.times(qty);
    const rowDirect = econ.directCostPerSale.times(qty);
    const rowContribution = rowNet.minus(rowDirect);
    const creditsSold =
      product.type === "private"
        ? new Decimal(0)
        : d(econ.creditsPerSale).times(qty);
    const redemptionsThisMonth = expectedCreditsRedeemedInMonth(
      product,
      assumptions,
      qty,
      0
    );

    rows.push({
      productId: product.id,
      productName: product.name,
      productType: product.type,
      sales: qty,
      netSales: rowNet,
      directCost: rowDirect,
      contribution: rowContribution,
      contributionPct: rowNet.isZero()
        ? new Decimal(0)
        : rowContribution.dividedBy(rowNet).times(100),
      contributionPerSale: econ.contributionPerSale,
      netSalesPerSale: econ.netSalesPerSale,
      creditsSold,
      expectedRedemptionsThisMonth:
        product.type === "private" ? d(qty) : redemptionsThisMonth,
      trace:
        product.type !== "private"
          ? analyzeFlexiblePack(product, assumptions).traces.netSales
          : undefined,
    });

    netSales = netSales.plus(rowNet);
    directCosts = directCosts.plus(rowDirect);
  }

  return { netSales, directCosts, rows };
}

/** Planning net profit from commercial sales using canonical calculatePL. */
export function calculatePlanningNetProfitFromSales(
  assumptions: FinanceAssumptions,
  quantities: Record<string, number>,
  targetMonth: number
): {
  netProfit: Decimal;
  netSales: Decimal;
  directCosts: Decimal;
  operatingExpenses: Decimal;
  pl: ReturnType<typeof calculatePL>;
} {
  const monthAssumptions = assumptionsForMonth(assumptions, targetMonth);
  const commercial = calculateCommercialTotals(monthAssumptions, quantities);

  const occupancy = getRampUpOccupancy(monthAssumptions, targetMonth);
  const capacity = calculateCapacity(monthAssumptions, occupancy);
  const classesPerMonth = capacity.weeklyClasses.times(WEEKS_PER_MONTH);
  const operatingExpenses = calculateOperatingExpenses(monthAssumptions, classesPerMonth);

  const revenueStub = {
    grossBookings: commercial.netSales,
    discounts: new Decimal(0),
    refunds: new Decimal(0),
    grossCustomerBillings: commercial.netSales,
    gstCollected: new Decimal(0),
    netRevenue: commercial.netSales,
  };

  const directStub = {
    variableInstructorPayouts: commercial.directCosts,
    sessionConsumables: new Decimal(0),
    paymentFees: new Decimal(0),
    directWorkshopCosts: new Decimal(0),
    totalDirectCosts: commercial.directCosts,
    trace: trace("Direct costs", "From commercial sales plan", "INR", [], commercial.directCosts),
  };

  const pl = calculatePL(
    monthAssumptions,
    revenueStub as import("./revenue").RevenueResult,
    directStub,
    operatingExpenses
  );

  return {
    netProfit: pl.netProfit,
    netSales: commercial.netSales,
    directCosts: commercial.directCosts,
    operatingExpenses: operatingExpenses.totalOperatingExpenses,
    pl,
  };
}

export function calculateExistingCreditDemandThisMonth(
  assumptions: FinanceAssumptions
): Decimal {
  const outstanding = d(assumptions.creditsSoldOutstanding);
  const expectedTotalRedeem = d(assumptions.creditsExpectedRedemptionBeforeExpiry);
  if (outstanding.isZero() || expectedTotalRedeem.isZero()) {
    return new Decimal(0);
  }

  const packs = listFlexiblePacks(assumptions);
  let avgValidityWeeks = d(8);
  if (packs.length > 0) {
    const weeks = packs.map((p) =>
      resolvePackRules(p).validityValue *
      (resolvePackRules(p).validityUnit === "days" ? 1 / 7 : 1)
    );
    avgValidityWeeks = d(weeks.reduce((a, b) => a + b, 0) / weeks.length);
  }

  const monthlyShare = WEEKS_PER_MONTH.dividedBy(
    avgValidityWeeks.isZero() ? 1 : avgValidityWeeks
  );
  return Decimal.min(outstanding, expectedTotalRedeem.times(monthlyShare));
}

export function calculateDeliveryFeasibility(
  assumptions: FinanceAssumptions,
  quantities: Record<string, number>,
  targetMonth: number,
  prefs: SalesTargetPreferences
): DeliveryFeasibility {
  const monthAssumptions = assumptionsForMonth(assumptions, targetMonth);
  const products = getCoreSalesProducts(monthAssumptions);

  let creditsSold = new Decimal(0);
  let expectedFromNew = new Decimal(0);
  let privateBookings = new Decimal(0);

  for (const product of products) {
    const qty = Math.max(0, quantities[product.id] ?? 0);
    if (qty === 0) continue;
    if (product.type === "private") {
      privateBookings = privateBookings.plus(qty);
      continue;
    }
    creditsSold = creditsSold.plus(d(product.creditsIncluded || 1).times(qty));
    expectedFromNew = expectedFromNew.plus(
      expectedCreditsRedeemedInMonth(product, monthAssumptions, qty, 0)
    );
  }

  const existingDemand = calculateExistingCreditDemandThisMonth(monthAssumptions);
  const totalDemand = expectedFromNew.plus(existingDemand).plus(privateBookings);

  const capacity = calculateCapacity(monthAssumptions, new Decimal(0));
  const available = capacity.monthlyAvailableSeats;
  const impliedOccupancyPct = available.isZero()
    ? new Decimal(0)
    : totalDemand.dividedBy(available).times(100);
  const remaining = Decimal.max(0, available.minus(totalDemand));

  let capacityStatus: CapacityStatus = "feasible";
  if (totalDemand.gt(available)) {
    capacityStatus = "not_feasible";
  } else if (impliedOccupancyPct.gte(prefs.capacityTightThresholdPct)) {
    capacityStatus = "tight";
  }

  const futureMonthWarnings: string[] = [];
  for (let futureOffset = 1; futureOffset <= 2; futureOffset++) {
    let futureDemand = existingDemand;
    for (const product of products) {
      const qty = Math.max(0, quantities[product.id] ?? 0);
      if (qty === 0 || product.type === "private") continue;
      futureDemand = futureDemand.plus(
        expectedCreditsRedeemedInMonth(product, monthAssumptions, qty, futureOffset)
      );
    }
    if (futureDemand.gt(available.times(0.9))) {
      futureMonthWarnings.push(
        `Month +${futureOffset}: expected ~${futureDemand.toFixed(0)} reformer redemptions may strain capacity (available ~${available.toFixed(0)}).`
      );
    }
  }

  let peakTimeWarning: string | undefined;
  if (
    monthAssumptions.useScheduleForCapacity &&
    monthAssumptions.schedule.length > 0 &&
    impliedOccupancyPct.gte(60)
  ) {
    peakTimeWarning =
      "Monthly capacity looks sufficient, but this sales plan may create peak-time constraints — verify schedule slots if redemption timing preferences are not modelled.";
  }

  return {
    creditsSold,
    expectedRedemptionsFromNewSales: expectedFromNew,
    expectedRedemptionsFromExistingCredits: existingDemand,
    privateBookings,
    totalReformerDemand: totalDemand,
    availableReformerSpots: available,
    impliedOccupancyPct,
    remainingCapacity: remaining,
    capacityStatus,
    peakTimeWarning,
    futureMonthWarnings,
  };
}

export function calculateClientBaseRequirement(
  assumptions: FinanceAssumptions,
  quantities: Record<string, number>,
  prefs: SalesTargetPreferences
): ClientRequirement {
  const products = getCoreSalesProducts(assumptions);
  const packHoldersRequired: Record<string, number> = {};
  const newSalesRequired: Record<string, number> = {};
  const renewingFromExisting: Record<string, number> = {};
  const totalActiveByProduct: Record<string, number> = {};

  let dropInPurchases = 0;
  let privateSessions = 0;
  let uniqueClients = new Decimal(0);

  for (const product of products) {
    const qty = Math.max(0, quantities[product.id] ?? 0);
    totalActiveByProduct[product.id] = qty;

    if (product.type === "drop_in") {
      dropInPurchases = qty;
      const dropInClients = d(qty).dividedBy(prefs.avgDropInPurchasesPerCustomerMonth);
      uniqueClients = uniqueClients.plus(dropInClients);
      newSalesRequired[product.id] = qty;
      continue;
    }

    if (product.type === "private") {
      privateSessions = qty;
      const privateClients = d(qty).dividedBy(prefs.avgPrivateSessionsPerClientMonth);
      uniqueClients = uniqueClients.plus(privateClients);
      const existing = prefs.existingActiveClientsByProductId?.[product.id] ?? 0;
      renewingFromExisting[product.id] = Math.min(existing, qty);
      newSalesRequired[product.id] = Math.max(0, qty - renewingFromExisting[product.id]);
      continue;
    }

    if (product.type === "credit_pack") {
      const holders = Math.ceil(qty / prefs.avgActivePacksPerPackCustomer);
      packHoldersRequired[product.id] = holders;
      const renewalPct =
        (prefs.packRenewalRatePctByProductId?.[product.id] ??
          product.renewalAssumptionPct ??
          60) / 100;
      const existing = prefs.existingActiveClientsByProductId?.[product.id] ?? 0;
      const renewing = Math.min(existing, Math.floor(existing * renewalPct));
      renewingFromExisting[product.id] = renewing;
      newSalesRequired[product.id] = Math.max(0, qty - renewing);
      uniqueClients = uniqueClients.plus(
        d(holders).dividedBy(prefs.avgActivePacksPerPackCustomer)
      );
    }
  }

  const newCustomersNeeded = Object.values(newSalesRequired).reduce((a, b) => a + b, 0);

  return {
    packHoldersRequired,
    dropInPurchasesRequired: dropInPurchases,
    privateSessionsRequired: privateSessions,
    estimatedUniqueActiveClients: uniqueClients,
    newSalesRequired,
    renewingFromExisting,
    totalActiveByProduct: totalActiveByProduct,
    newCustomersNeededThisMonth: d(newCustomersNeeded),
    isPlanningEstimate: true,
  };
}

export function calculateAcquisitionFunnel(
  newPayingClients: number,
  prefs: SalesTargetPreferences
): AcquisitionFunnel | undefined {
  if (prefs.leadToPaidPct != null && prefs.leadToPaidPct > 0) {
    const enquiries = Math.ceil(newPayingClients / (prefs.leadToPaidPct / 100));
    return {
      newPayingClientsRequired: newPayingClients,
      enquiriesRequired: enquiries,
      steps: [
        `${enquiries} enquiries`,
        `↓`,
        `${newPayingClients} new paying clients (${prefs.leadToPaidPct}% lead → paid)`,
      ],
    };
  }

  if (
    prefs.leadToQualifiedPct != null &&
    prefs.leadToQualifiedPct > 0 &&
    prefs.qualifiedToPaidPct != null &&
    prefs.qualifiedToPaidPct > 0
  ) {
    const qualified = Math.ceil(newPayingClients / (prefs.qualifiedToPaidPct / 100));
    const enquiries = Math.ceil(qualified / (prefs.leadToQualifiedPct / 100));
    return {
      newPayingClientsRequired: newPayingClients,
      qualifiedLeadsRequired: qualified,
      enquiriesRequired: enquiries,
      steps: [
        `${enquiries} enquiries`,
        `↓`,
        `${qualified} qualified leads / trials (${prefs.leadToQualifiedPct}% enquiry → qualified)`,
        `↓`,
        `${newPayingClients} new paying clients (${prefs.qualifiedToPaidPct}% qualified → paid)`,
      ],
    };
  }

  return undefined;
}

function salesMixWeights(
  products: Product[],
  economics: ProductCommercialEconomics[],
  prefs: SalesTargetPreferences,
  mode: SalesSolutionMode
): Record<string, number> {
  const weights: Record<string, number> = {};

  if (prefs.salesMixMode === "custom" && Object.keys(prefs.customSalesMixPct).length > 0) {
    for (const e of economics) {
      weights[e.product.id] = prefs.customSalesMixPct[e.product.id] ?? 0;
    }
  } else if (mode === "profit_maximising" || prefs.salesMixMode === "auto") {
    for (const e of economics) {
      weights[e.product.id] = Math.max(0, e.contributionPerSale.toNumber());
    }
  } else {
    for (const p of products) {
      weights[p.id] = p.packageMixPct ?? p.serviceDemandPct ?? 0;
    }
  }

  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (total <= 0) {
    for (const p of products) weights[p.id] = 1;
    return weights;
  }
  for (const id of Object.keys(weights)) {
    weights[id] = (weights[id] / total) * 100;
  }
  return weights;
}

function pickNextProduct(
  economics: ProductCommercialEconomics[],
  weights: Record<string, number>,
  mode: SalesSolutionMode,
  current: Record<string, number>
): ProductCommercialEconomics {
  if (mode === "profit_maximising") {
    return [...economics].sort(
      (a, b) => b.contributionPerSale.minus(a.contributionPerSale).toNumber()
    )[0];
  }

  if (mode === "lowest_client_count") {
    return [...economics].sort((a, b) => {
      const clientWeight = (e: ProductCommercialEconomics) => {
        if (e.product.type === "credit_pack") return -e.creditsPerSale;
        if (e.product.type === "drop_in") return 100;
        return 0;
      };
      const cw = clientWeight(b) - clientWeight(a);
      if (cw !== 0) return cw;
      return b.contributionPerSale.minus(a.contributionPerSale).toNumber();
    })[0];
  }

  // Balanced — pick product most under its mix target
  const totalSales = Object.values(current).reduce((a, b) => a + b, 0) + 1;
  let best = economics[0];
  let bestDeficit = -Infinity;
  for (const e of economics) {
    const targetShare = (weights[e.product.id] ?? 0) / 100;
    const currentShare = (current[e.product.id] ?? 0) / Math.max(1, totalSales);
    const deficit = targetShare - currentShare;
    if (deficit > bestDeficit) {
      bestDeficit = deficit;
      best = e;
    }
  }
  return best;
}

export function solveSalesForProfitTarget(
  assumptions: FinanceAssumptions,
  targetProfit: number,
  mode: SalesSolutionMode,
  targetMonth: number,
  prefsOverride?: Partial<SalesTargetPreferences>
): Record<string, number> {
  const prefs = SalesTargetPreferencesSchema.parse({
    ...resolvePreferences(assumptions),
    ...prefsOverride,
    solutionMode: mode,
  });

  const monthAssumptions = assumptionsForMonth(assumptions, targetMonth);
  const products = getCoreSalesProducts(monthAssumptions);
  const economics = products.map((p) => computeProductCommercialEconomics(p, monthAssumptions));
  const positive = economics.filter((e) => e.contributionPerSale.gt(0));
  if (positive.length === 0) {
    return Object.fromEntries(products.map((p) => [p.id, 0]));
  }

  const weights = salesMixWeights(products, positive, prefs, mode);
  const quantities: Record<string, number> = Object.fromEntries(
    products.map((p) => [p.id, 0])
  );

  const maxIterations = 50_000;
  for (let i = 0; i < maxIterations; i++) {
    const result = calculatePlanningNetProfitFromSales(monthAssumptions, quantities, targetMonth);
    if (result.netProfit.gte(targetProfit)) break;

    const next = pickNextProduct(positive, weights, mode, quantities);
    if (!next.contributionPerSale.isPositive()) break;
    quantities[next.product.id] = (quantities[next.product.id] ?? 0) + 1;
  }

  return quantities;
}

function buildSolution(
  assumptions: FinanceAssumptions,
  quantities: Record<string, number>,
  mode: SalesSolutionMode,
  targetProfit: number,
  targetMonth: number,
  prefs: SalesTargetPreferences
): SalesTargetSolution {
  const monthAssumptions = assumptionsForMonth(assumptions, targetMonth);
  const products = getCoreSalesProducts(monthAssumptions);
  const commercial = calculateCommercialTotals(monthAssumptions, quantities);
  const plResult = calculatePlanningNetProfitFromSales(
    monthAssumptions,
    quantities,
    targetMonth
  );
  const target = d(targetProfit);

  return {
    mode,
    quantities: recordToQuantities(quantities, products),
    netSales: commercial.netSales,
    directCosts: commercial.directCosts,
    operatingExpenses: plResult.operatingExpenses,
    planningNetProfit: plResult.netProfit,
    surplusToTarget: plResult.netProfit.minus(target),
    productRows: commercial.rows,
    delivery: calculateDeliveryFeasibility(monthAssumptions, quantities, targetMonth, prefs),
    clients: calculateClientBaseRequirement(monthAssumptions, quantities, prefs),
  };
}

/** Evaluate a manual sales mix — returns profit, delivery, and client outputs. */
export function evaluateSalesPlan(
  assumptions: FinanceAssumptions,
  quantities: Record<string, number>,
  targetMonth: number,
  targetProfit?: number,
  prefsOverride?: Partial<SalesTargetPreferences>
): SalesTargetSolution {
  const prefs = SalesTargetPreferencesSchema.parse({
    ...resolvePreferences(assumptions),
    ...prefsOverride,
  });
  const profitTarget = targetProfit ?? prefs.targetMonthlyNetProfit;
  return buildSolution(
    assumptions,
    quantities,
    prefs.solutionMode,
    profitTarget,
    targetMonth,
    prefs
  );
}

function forecastSalesByProduct(assumptions: FinanceAssumptions): Record<string, number> {
  const map: Record<string, number> = {};
  for (const p of listFlexiblePacks(assumptions)) {
    const rules = resolvePackRules(p);
    map[p.id] = rules.expectedSalesVolumePerMonth ?? 0;
  }
  const privateProduct = getPrivateProduct(assumptions);
  if (privateProduct) {
    map[privateProduct.id] = Math.round(assumptions.privateSessionsPerMonth ?? 0);
  }
  return map;
}

export function runSalesTargetAnalysis(
  assumptions: FinanceAssumptions,
  prefsOverride?: Partial<SalesTargetPreferences>
): SalesTargetAnalysis {
  const prefs = SalesTargetPreferencesSchema.parse({
    ...resolvePreferences(assumptions),
    ...prefsOverride,
  });
  const targetMonth = prefs.targetMonth;
  const targetProfit = d(prefs.targetMonthlyNetProfit);

  const monthAssumptions = assumptionsForMonth(assumptions, targetMonth);
  const forecastModel = runFinanceModel(monthAssumptions);
  const forecastProfit = forecastModel.pl.netProfit;
  const profitGap = targetProfit.minus(forecastProfit);

  const modes: SalesSolutionMode[] = [
    "balanced",
    "profit_maximising",
    "lowest_client_count",
  ];

  const solutions = modes.map((mode) => {
    const quantities = solveSalesForProfitTarget(
      assumptions,
      prefs.targetMonthlyNetProfit,
      mode,
      targetMonth,
      { ...prefs, solutionMode: mode }
    );
    return buildSolution(
      assumptions,
      quantities,
      mode,
      prefs.targetMonthlyNetProfit,
      targetMonth,
      prefs
    );
  });

  const primarySolution =
    solutions.find((s) => s.mode === prefs.solutionMode) ?? solutions[0];

  const forecastSales = forecastSalesByProduct(monthAssumptions);
  const requiredVsForecast = primarySolution.quantities.map((q) => ({
    productId: q.productId,
    productName: q.productName,
    required: q.quantity,
    forecast: forecastSales[q.productId] ?? 0,
    gap: q.quantity - (forecastSales[q.productId] ?? 0),
  }));

  return {
    preferences: prefs,
    targetMonth,
    targetProfit,
    forecastProfit,
    profitGap,
    solutions,
    primarySolution,
    requiredVsForecast,
    engineVersion: SALES_TARGET_ENGINE_VERSION,
  };
}
