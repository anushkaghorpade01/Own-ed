/**
 * One-time migration from localStorage → IndexedDB.
 */
import {
  getAppDataPayload,
  getMetaFlag,
  saveAppDataPayload,
  setMetaFlag,
  META_MIGRATION_KEY,
} from "./db";
import { appStateToPayload, payloadToAppState } from "./app-state-bridge";
import type { AppState } from "@/lib/store/app-state";
import { defaultAppState } from "@/lib/store/default-state";

const LEGACY_STORAGE_KEY = "owned-app-state-v1";

export async function migrateFromLocalStorageIfNeeded(): Promise<{
  migrated: boolean;
  source: "indexeddb" | "localStorage" | "default";
}> {
  const existing = await getAppDataPayload();
  if (existing) {
    return { migrated: false, source: "indexeddb" };
  }

  const alreadyMigrated = await getMetaFlag(META_MIGRATION_KEY);
  if (alreadyMigrated) {
    return { migrated: false, source: "default" };
  }

  if (typeof localStorage === "undefined") {
    return { migrated: false, source: "default" };
  }

  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) {
    await setMetaFlag(META_MIGRATION_KEY, true);
    return { migrated: false, source: "default" };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const merged: AppState = {
      ...defaultAppState(),
      ...parsed,
      undoStack: [],
    };
    const payload = appStateToPayload(merged);
    await saveAppDataPayload(payload);
    await setMetaFlag(META_MIGRATION_KEY, true);
    // Keep localStorage as read-only fallback until user clears — do not delete silently
    return { migrated: true, source: "localStorage" };
  } catch (error) {
    console.error("localStorage migration failed:", error);
    await setMetaFlag(META_MIGRATION_KEY, true);
    return { migrated: false, source: "default" };
  }
}

export async function loadInitialAppState(): Promise<AppState> {
  await migrateFromLocalStorageIfNeeded();
  const payload = await getAppDataPayload();
  if (payload) {
    return payloadToAppState(payload);
  }
  return defaultAppState();
}
