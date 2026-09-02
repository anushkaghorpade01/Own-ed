import type { Scenario } from "./schemas";

/** Draft scenario created via Optimise → Test scenario (not hand-built). */
export function isOptimisationDraftScenario(scenario: Pick<Scenario, "id">): boolean {
  return scenario.id.startsWith("scenario-opt-");
}
