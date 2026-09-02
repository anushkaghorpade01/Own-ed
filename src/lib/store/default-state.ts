/**
 * Default AppState factory — shared by store and persistence (avoids circular imports).
 */
import type { AppState } from "./app-state";
import {
  createSampleAssumptions,
  createSampleDecisions,
  createSampleQuestions,
  createSampleActions,
  createSampleStudios,
  createSampleScenarios,
  createSampleLibraryItems,
  createSampleSpaceImages,
  createSampleRoadmapItems,
  createSampleProductConcepts,
  createSampleProgrammingItems,
} from "@/lib/finance/sample-data";

export function defaultAppState(): AppState {
  const assumptions = createSampleAssumptions();
  return {
    assumptions,
    decisions: createSampleDecisions(),
    questions: createSampleQuestions(),
    actions: createSampleActions(),
    mathReviewItems: [],
    roadmapItems: createSampleRoadmapItems(),
    productConcepts: createSampleProductConcepts(),
    programmingItems: createSampleProgrammingItems(),
    studios: createSampleStudios(),
    spaceImages: createSampleSpaceImages(),
    brandItems: [],
    libraryItems: createSampleLibraryItems(),
    scenarios: createSampleScenarios(assumptions),
    snapshots: [],
    productVersionHistory: {},
    undoStack: [],
  };
}
