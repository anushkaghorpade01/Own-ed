import type { FinanceAssumptions, Scenario } from "./schemas";

/** Draft scenario created via Optimise → Test scenario (not hand-built). */
export function isOptimisationDraftScenario(scenario: Pick<Scenario, "id">): boolean {
  return scenario.id.startsWith("scenario-opt-");
}

/** Live assumptions saved on the Assumptions page — the canonical Base Case inputs. */
export function resolveBaseAssumptionsForAnalysis(
  liveAssumptions: FinanceAssumptions,
  baseScenario?: Pick<Scenario, "name" | "assumptions">
): FinanceAssumptions {
  return {
    ...liveAssumptions,
    name: baseScenario?.name ?? liveAssumptions.name ?? "Base Case",
  };
}

/** Base Case scenarios always reflect saved assumptions; other scenarios keep their own copy. */
export function resolveScenarioAssumptionsForAnalysis(
  scenario: Scenario,
  liveAssumptions: FinanceAssumptions
): FinanceAssumptions {
  if (!scenario.isBaseCase) {
    const assumptions = scenario.assumptions;
    // Pre-OWN scenarios have a legacy credit catalogue. In OWN mode carry the
    // live product/schedule plan into each scenario, and apply its occupancy
    // change as a relative demand change to expected package purchases.
    const basePlan = liveAssumptions.ownOperatingPlan;
    if (!basePlan?.enabled) return assumptions;
    const scenarioPlan = assumptions.ownOperatingPlan?.enabled ? assumptions.ownOperatingPlan : basePlan;
    const baseOccupancy = Math.max(1, liveAssumptions.projectedBookedOccupancyPct);
    const demandScale = Math.max(0, assumptions.projectedBookedOccupancyPct / baseOccupancy);
    return {
      ...assumptions,
      ownOperatingPlan: {
        ...scenarioPlan,
        packages: scenarioPlan.packages.map(p => ({...p, expectedSalesPerMonth: p.expectedSalesPerMonth * demandScale})),
        newMembersPerMonth: Math.round(scenarioPlan.newMembersPerMonth * demandScale),
      },
    };
  }
  return resolveBaseAssumptionsForAnalysis(liveAssumptions, scenario);
}
