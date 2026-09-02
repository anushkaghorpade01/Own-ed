/**
 * IndexedDB — canonical local store for Own-ed.
 * Schema-versioned; migrations run on open when DB_VERSION increases.
 */
import type { LocalDbPayload } from "../types";

export const DB_NAME = "owned-db";
export const DB_VERSION = 1;

export const STORE = {
  meta: "meta",
  appData: "appData",
  assets: "assets",
  uiPrefs: "uiPrefs",
} as const;

export const APP_DATA_KEY = "current";
export const META_MIGRATION_KEY = "localStorageMigrated";
export const META_SCHEMA_KEY = "schemaVersion";

export interface AssetBlobRecord {
  assetId: string;
  blob: Blob;
  filename: string;
  mimeType: string;
  category: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  sourceUrl?: string;
  filesystemRelativePath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UiPrefsRecord {
  key: string;
  value: unknown;
}

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function openOwnedDb(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new Error("IndexedDB is not available in this environment"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE.meta)) {
          db.createObjectStore(STORE.meta, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(STORE.appData)) {
          db.createObjectStore(STORE.appData, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(STORE.assets)) {
          db.createObjectStore(STORE.assets, { keyPath: "assetId" });
        }
        if (!db.objectStoreNames.contains(STORE.uiPrefs)) {
          db.createObjectStore(STORE.uiPrefs, { keyPath: "key" });
        }
      };
    });
  }
  return dbPromise;
}

export async function idbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openOwnedDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error ?? new Error(`idbGet failed: ${storeName}/${key}`));
  });
}

export async function idbPut<T extends { key?: string; assetId?: string }>(
  storeName: string,
  value: T
): Promise<void> {
  const db = await openOwnedDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error(`idbPut failed: ${storeName}`));
    tx.objectStore(storeName).put(value);
  });
}

export async function idbDelete(storeName: string, key: string): Promise<void> {
  const db = await openOwnedDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error(`idbDelete failed: ${storeName}/${key}`));
    tx.objectStore(storeName).delete(key);
  });
}

export async function idbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await openOwnedDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve((req.result ?? []) as T[]);
    req.onerror = () => reject(req.error ?? new Error(`idbGetAll failed: ${storeName}`));
  });
}

export async function idbClearStore(storeName: string): Promise<void> {
  const db = await openOwnedDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error(`idbClearStore failed: ${storeName}`));
    tx.objectStore(storeName).clear();
  });
}

export async function getAppDataPayload(): Promise<LocalDbPayload | undefined> {
  const row = await idbGet<{ key: string; payload: LocalDbPayload }>(STORE.appData, APP_DATA_KEY);
  return row?.payload;
}

export async function saveAppDataPayload(payload: LocalDbPayload): Promise<void> {
  await idbPut(STORE.appData, {
    key: APP_DATA_KEY,
    payload,
    updatedAt: new Date().toISOString(),
  });
}

export async function getMetaFlag(key: string): Promise<boolean> {
  const row = await idbGet<{ key: string; value: boolean }>(STORE.meta, key);
  return row?.value === true;
}

export async function setMetaFlag(key: string, value: boolean): Promise<void> {
  await idbPut(STORE.meta, { key, value });
}

/** Reset open promise — for tests */
export function resetDbForTests(): void {
  dbPromise = null;
}
