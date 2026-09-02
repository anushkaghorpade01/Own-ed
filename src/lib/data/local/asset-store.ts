/**
 * IndexedDB blob storage for uploaded files.
 */
import { v4 as uuidv4 } from "uuid";
import type { AssetRecord } from "../types";
import type { AssetUploadMeta } from "../repositories";
import {
  idbDelete,
  idbGet,
  idbGetAll,
  idbPut,
  openOwnedDb,
  STORE,
  type AssetBlobRecord,
} from "./db";

const blobUrlCache = new Map<string, string>();

export function revokeAssetBlobUrl(assetId: string): void {
  const url = blobUrlCache.get(assetId);
  if (url) {
    URL.revokeObjectURL(url);
    blobUrlCache.delete(assetId);
  }
}

export async function getAssetBlobUrl(assetId: string): Promise<string | null> {
  const cached = blobUrlCache.get(assetId);
  if (cached) return cached;

  const record = await idbGet<AssetBlobRecord>(STORE.assets, assetId);
  if (!record?.blob) return null;

  const url = URL.createObjectURL(record.blob);
  blobUrlCache.set(assetId, url);
  return url;
}

export async function getAssetRecord(assetId: string): Promise<AssetBlobRecord | undefined> {
  return idbGet<AssetBlobRecord>(STORE.assets, assetId);
}

export async function saveAssetBlob(
  file: Blob,
  meta: AssetUploadMeta,
  assetId = uuidv4()
): Promise<AssetRecord> {
  const now = new Date().toISOString();
  const record: AssetBlobRecord = {
    assetId,
    blob: file,
    filename: meta.filename,
    mimeType: meta.mimeType,
    category: meta.category,
    linkedEntityType: meta.linkedEntityType,
    linkedEntityId: meta.linkedEntityId,
    sourceUrl: meta.sourceUrl,
    filesystemRelativePath: meta.folderPath,
    createdAt: now,
    updatedAt: now,
  };
  await idbPut(STORE.assets, record);

  return {
    assetId,
    filename: meta.filename,
    mimeType: meta.mimeType,
    category: meta.category,
    localBlobId: assetId,
    filesystemRelativePath: meta.folderPath,
    linkedEntityType: meta.linkedEntityType,
    linkedEntityId: meta.linkedEntityId,
    sourceUrl: meta.sourceUrl,
    notes: meta.notes,
    tags: meta.tags ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function deleteAssetBlob(assetId: string): Promise<void> {
  revokeAssetBlobUrl(assetId);
  await idbDelete(STORE.assets, assetId);
}

export async function listAssetBlobs(): Promise<AssetBlobRecord[]> {
  return idbGetAll<AssetBlobRecord>(STORE.assets);
}

export async function countAssets(): Promise<number> {
  const all = await listAssetBlobs();
  return all.length;
}

/** Migrate inline data-URL to blob store; returns assetId */
export async function migrateDataUrlToBlob(
  dataUrl: string,
  meta: AssetUploadMeta
): Promise<string> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const asset = await saveAssetBlob(blob, meta);
  return asset.assetId;
}

export async function clearAllAssets(): Promise<void> {
  for (const id of blobUrlCache.keys()) {
    revokeAssetBlobUrl(id);
  }
  const db = await openOwnedDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE.assets, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE.assets).clear();
  });
}
