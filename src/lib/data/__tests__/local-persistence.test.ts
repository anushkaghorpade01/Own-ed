/**
 * Local-first persistence tests — IndexedDB, migration, assets, backup.
 */
import { beforeEach, describe, it, expect, vi } from "vitest";
import "fake-indexeddb/auto";
import { resetDbForTests, idbClearStore, STORE } from "../local/db";
import { persistenceService, appStateToPayload, payloadToAppState } from "../local/persistence-service";
import { countPayloadRecords } from "../local/app-state-bridge";
import { defaultAppState } from "@/lib/store/default-state";
import { migrateFromLocalStorageIfNeeded } from "../local/migrate-from-localStorage";
import { saveAssetBlob, getAssetBlobUrl, countAssets } from "../local/asset-store";
import { exportOwnedBackup, validateBackup, backupToAppState } from "../local/backup";
import { supportsIndexedDb } from "../local/capabilities";
import { createSampleAssumptions } from "@/lib/finance/sample-data";

const LEGACY_KEY = "owned-app-state-v1";

const lsStore: Record<string, string> = {};

function mockLocalStorage() {
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => lsStore[k] ?? null,
    setItem: (k: string, v: string) => {
      lsStore[k] = v;
    },
    removeItem: (k: string) => {
      delete lsStore[k];
    },
    clear: () => {
      for (const k of Object.keys(lsStore)) delete lsStore[k];
    },
  });
}

describe("IndexedDB persistence", () => {
  beforeEach(async () => {
    mockLocalStorage();
    for (const k of Object.keys(lsStore)) delete lsStore[k];
    resetDbForTests();
    await idbClearStore(STORE.appData);
    await idbClearStore(STORE.meta);
    await idbClearStore(STORE.assets);
  });

  it("supports IndexedDB in test environment", () => {
    expect(supportsIndexedDb()).toBe(true);
  });

  it("saves and reloads assumptions after simulated reload", async () => {
    const state = defaultAppState();
    state.assumptions.rent = 275_000;
    await persistenceService.saveAppState(state);

    resetDbForTests();
    const loaded = await persistenceService.loadAppState();
    expect(loaded.assumptions.rent).toBe(275_000);
  });

  it("persists 8-pack price change across reload", async () => {
    const state = defaultAppState();
    state.assumptions.products = state.assumptions.products.map((p) =>
      p.id === "8-pack" ? { ...p, price: 14_500 } : p
    );
    await persistenceService.saveAppState(state);

    resetDbForTests();
    const loaded = await persistenceService.loadAppState();
    const pack = loaded.assumptions.products.find((p) => p.id === "8-pack");
    expect(pack?.price).toBe(14_500);
  });

  it("persists scenarios across reload", async () => {
    const state = defaultAppState();
    const scenarioCount = state.scenarios.length;
    await persistenceService.saveAppState(state);

    resetDbForTests();
    const loaded = await persistenceService.loadAppState();
    expect(loaded.scenarios.length).toBe(scenarioCount);
  });

  it("migrates localStorage blob to IndexedDB on first launch", async () => {
    const assumptions = createSampleAssumptions();
    assumptions.rent = 333_333;
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify({
        assumptions,
        decisions: [],
        scenarios: [],
        brandItems: [],
      })
    );

    const result = await migrateFromLocalStorageIfNeeded();
    expect(result.migrated).toBe(true);
    expect(result.source).toBe("localStorage");

    resetDbForTests();
    const loaded = await persistenceService.loadAppState();
    expect(loaded.assumptions.rent).toBe(333_333);
  });

  it("stores asset blobs and resolves blob URLs", async () => {
    const blob = new Blob(["test-image-bytes"], { type: "image/png" });
    const asset = await saveAssetBlob(blob, {
      filename: "cat-reference-001.png",
      mimeType: "image/png",
      category: "brand-image",
      folderPath: "brand/images/cat-reference-001.png",
    });
    expect(await countAssets()).toBe(1);
    const url = await getAssetBlobUrl(asset.assetId);
    expect(url).toMatch(/^blob:/);
  });

  it("exports and validates backup JSON", async () => {
    const state = defaultAppState();
    state.assumptions.rent = 200_000;
    const backup = await exportOwnedBackup(state);
    expect(validateBackup(backup)).toBe(true);
    expect(backup.schemaVersion).toBe(1);
    const restored = backupToAppState(backup);
    expect(restored.assumptions.rent).toBe(200_000);
  });

  it("countPayloadRecords handles legacy payloads missing programmingItems", () => {
    const payload = appStateToPayload(defaultAppState());
    const legacy = {
      ...payload,
      extensions: {
        productConcepts: payload.extensions.productConcepts,
        brandItems: payload.extensions.brandItems,
        spaceImages: payload.extensions.spaceImages,
        productVersionHistory: payload.extensions.productVersionHistory,
      },
    } as typeof payload;

    expect(() => countPayloadRecords(legacy)).not.toThrow();
    expect(payloadToAppState(legacy).programmingItems).toEqual([]);
  });
});
