/**
 * Bridge between React AppState and IndexedDB LocalDbPayload.
 */
import type { AppState } from "@/lib/store/app-state";
import type { LocalDbPayload, LegacyAppState } from "../types";
import { migrateLegacyAppState, denormalizeToLegacyShape } from "../migration/local-to-normalized";
import { DB_VERSION } from "./db";

function normalizePayloadExtensions(
  extensions: LocalDbPayload["extensions"] | undefined
): LocalDbPayload["extensions"] {
  return {
    mathReviewItems: extensions?.mathReviewItems ?? [],
    productConcepts: extensions?.productConcepts ?? [],
    programmingItems: extensions?.programmingItems ?? [],
    brandItems: extensions?.brandItems ?? [],
    spaceImages: extensions?.spaceImages ?? [],
    productVersionHistory: extensions?.productVersionHistory ?? {},
  };
}

export function appStateToLegacy(state: AppState): LegacyAppState & {
  mathReviewItems: AppState["mathReviewItems"];
  brandItems: AppState["brandItems"];
    productConcepts: AppState["productConcepts"];
    programmingItems: AppState["programmingItems"];
    spaceImages: AppState["spaceImages"];
} {
  const { undoStack: _u, ...rest } = state;
  return rest;
}

export function appStateToPayload(state: AppState): LocalDbPayload {
  const legacy = appStateToLegacy(state);
  const { data } = migrateLegacyAppState(legacy);

  return {
    schemaVersion: DB_VERSION,
    normalized: {
      ...data,
      // Preserve full brand/space in extensions; assets tab holds metadata refs
    },
    extensions: {
      mathReviewItems: state.mathReviewItems,
      productConcepts: state.productConcepts,
      programmingItems: state.programmingItems,
      brandItems: state.brandItems,
      spaceImages: state.spaceImages,
      productVersionHistory: state.productVersionHistory,
    },
    savedAt: new Date().toISOString(),
  };
}

export function payloadToAppState(payload: LocalDbPayload): AppState {
  const legacy = denormalizeToLegacyShape(payload.normalized);
  const defaults = normalizePayloadExtensions(payload.extensions);

  return {
    assumptions: legacy.assumptions!,
    decisions: legacy.decisions ?? [],
    questions: legacy.questions ?? [],
    actions: legacy.actions ?? [],
    mathReviewItems: defaults.mathReviewItems ?? [],
    roadmapItems: legacy.roadmapItems ?? [],
    productConcepts: defaults.productConcepts ?? [],
    programmingItems: defaults.programmingItems ?? [],
    studios: legacy.studios ?? [],
    spaceImages: defaults.spaceImages?.length
      ? defaults.spaceImages
      : legacy.spaceImages ?? [],
    brandItems: defaults.brandItems ?? [],
    libraryItems: legacy.libraryItems ?? [],
    scenarios: legacy.scenarios ?? [],
    snapshots: legacy.snapshots ?? [],
    productVersionHistory: defaults.productVersionHistory ?? legacy.productVersionHistory ?? {},
    undoStack: [],
  };
}

export function countPayloadRecords(payload: LocalDbPayload): number {
  const n = payload.normalized;
  const ext = normalizePayloadExtensions(payload.extensions);
  return (
    n.products.length +
    n.scenarios.length +
    n.scenarioSnapshots.length +
    n.studios.length +
    n.decisions.length +
    n.openQuestions.length +
    n.roadmap.length +
    n.library.length +
    n.assets.length +
    ext.mathReviewItems.length +
    ext.productConcepts.length +
    ext.programmingItems.length +
    ext.brandItems.length +
    ext.spaceImages.length +
    1
  );
}
