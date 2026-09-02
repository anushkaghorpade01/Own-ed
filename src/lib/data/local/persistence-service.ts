/**
 * Local-first persistence orchestrator.
 * IndexedDB is canonical; optional folder mirror is best-effort.
 */
import type { AppState } from "@/lib/store/app-state";
import type { LocalPersistenceStats, LocalSaveStatus } from "../types";
import type { AssetUploadMeta } from "../repositories";
import {
  clearAllAssets,
  countAssets,
  saveAssetBlob,
  migrateDataUrlToBlob,
} from "./asset-store";
import { appStateToPayload, countPayloadRecords, payloadToAppState } from "./app-state-bridge";
import {
  getAppDataPayload,
  saveAppDataPayload,
  idbClearStore,
  openOwnedDb,
  STORE,
  DB_VERSION,
} from "./db";
import { loadInitialAppState } from "./migrate-from-localStorage";
import {
  mirrorPayloadToFolder,
  getFolderConnectionState,
  chooseLocalFolder,
  reconnectLocalFolder,
  disconnectLocalFolder,
  writeAssetToFolder,
  getStoredFolderName,
} from "./filesystem-mirror";

type SaveStatusListener = (status: LocalSaveStatus, lastSavedAt?: string) => void;
type StatsListener = (stats: LocalPersistenceStats) => void;

let saveStatus: LocalSaveStatus = "idle";
let lastLocalSaveAt: string | undefined;
let folderSyncTimer: ReturnType<typeof setTimeout> | null = null;
const statusListeners = new Set<SaveStatusListener>();
const statsListeners = new Set<StatsListener>();

function notifyStatus(status: LocalSaveStatus, at?: string) {
  saveStatus = status;
  if (at) lastLocalSaveAt = at;
  statusListeners.forEach((fn) => fn(status, lastLocalSaveAt));
}

function notifyStats(payload: Awaited<ReturnType<typeof buildStats>>) {
  statsListeners.forEach((fn) => fn(payload));
}

async function buildStats(): Promise<LocalPersistenceStats> {
  const payload = await getAppDataPayload();
  const folder = getFolderConnectionState();
  return {
    recordCount: payload ? countPayloadRecords(payload) : 0,
    assetCount: await countAssets(),
    lastLocalSaveAt,
    folderConnected: folder.connected,
    folderName: folder.name ?? getStoredFolderName(),
    lastFolderSyncAt: folder.lastSyncAt,
    schemaVersion: DB_VERSION,
  };
}

function scheduleFolderMirror(payload: ReturnType<typeof appStateToPayload>) {
  if (!getFolderConnectionState().connected) return;
  if (folderSyncTimer) clearTimeout(folderSyncTimer);
  folderSyncTimer = setTimeout(() => {
    mirrorPayloadToFolder(payload).catch(() => {
      // IndexedDB save already succeeded — folder failure is non-blocking
    });
  }, 3000);
}

export const persistenceService = {
  async loadAppState(): Promise<AppState> {
    return loadInitialAppState();
  },

  async saveAppState(state: AppState): Promise<void> {
    notifyStatus("saving");
    try {
      const payload = appStateToPayload(state);
      await saveAppDataPayload(payload);
      const savedAt = new Date().toISOString();
      notifyStatus("saved", savedAt);
      notifyStats(await buildStats());
      scheduleFolderMirror(payload);
    } catch (error) {
      console.error("IndexedDB save failed:", error);
      notifyStatus("error");
      throw error;
    }
  },

  subscribeSaveStatus(listener: SaveStatusListener): () => void {
    statusListeners.add(listener);
    listener(saveStatus, lastLocalSaveAt);
    return () => statusListeners.delete(listener);
  },

  subscribeStats(listener: StatsListener): () => void {
    statsListeners.add(listener);
    buildStats().then(listener).catch(console.error);
    return () => statsListeners.delete(listener);
  },

  getSaveStatus(): LocalSaveStatus {
    return saveStatus;
  },

  async uploadAsset(file: Blob, meta: AssetUploadMeta) {
    const asset = await saveAssetBlob(file, meta);
    const rel = meta.folderPath;
    if (rel && getFolderConnectionState().connected) {
      const ok = await writeAssetToFolder(rel, file);
      if (!ok) {
        console.warn("Saved locally. Folder backup couldn't be updated.");
      }
    }
    return asset;
  },

  async migrateInlineDataUrl(dataUrl: string, meta: AssetUploadMeta): Promise<string> {
    return migrateDataUrlToBlob(dataUrl, meta);
  },

  async chooseFolder() {
    const state = await chooseLocalFolder();
    notifyStats(await buildStats());
    return state;
  },

  async reconnectFolder() {
    const state = await reconnectLocalFolder();
    notifyStats(await buildStats());
    return state;
  },

  disconnectFolder() {
    disconnectLocalFolder();
    notifyStats({
      recordCount: 0,
      assetCount: 0,
      folderConnected: false,
      schemaVersion: DB_VERSION,
    });
  },

  async syncFolderNow(state: AppState) {
    const payload = appStateToPayload(state);
    await mirrorPayloadToFolder(payload);
    notifyStats(await buildStats());
  },

  getFolderState: getFolderConnectionState,

  async clearLocalData(options: { includeAssets?: boolean } = {}): Promise<void> {
    await idbClearStore(STORE.appData);
    await idbClearStore(STORE.meta);
    if (options.includeAssets) {
      await clearAllAssets();
    }
    notifyStatus("idle");
    notifyStats(await buildStats());
  },

  async replaceFromPayload(state: AppState): Promise<void> {
    await this.saveAppState(state);
  },
};

export { loadInitialAppState, payloadToAppState, appStateToPayload };
