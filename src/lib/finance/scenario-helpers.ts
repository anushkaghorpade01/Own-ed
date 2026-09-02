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
  if (!scenario.isBaseCase) return scenario.assumptions;
  return resolveBaseAssumptionsForAnalysis(liveAssumptions, scenario);
}
