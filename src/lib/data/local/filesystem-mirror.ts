/**
 * Optional File System Access API mirror — human-readable backup alongside IndexedDB.
 * IndexedDB remains canonical; folder writes are best-effort.
 */
import type { LocalDbPayload, OwnedBackupV1 } from "../types";
import { listAssetBlobs } from "./asset-store";

const FOLDER_HANDLE_KEY = "owned-folder-handle";
const FOLDER_NAME_KEY = "owned-folder-name";

export interface FolderConnectionState {
  connected: boolean;
  name?: string;
  lastSyncAt?: string;
}

let directoryHandle: FileSystemDirectoryHandle | null = null;
let lastFolderSyncAt: string | undefined;

const OWN_ED_ROOT = "Own-ed";

const SUBFOLDERS = [
  "data",
  "brand/images",
  "brand/references",
  "brand/documents",
  "space/moodboards",
  "space/floor-plans",
  "space/references",
  "space/uploads",
  "studios/attachments",
  "programming/attachments",
  "product/attachments",
  "library",
  "exports",
  "backups",
] as const;

async function ensureSubfolders(root: FileSystemDirectoryHandle): Promise<void> {
  for (const path of SUBFOLDERS) {
    const parts = path.split("/");
    let current = root;
    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: true });
    }
  }
}

async function getOrCreateOwnEdRoot(picked: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  if (picked.name === OWN_ED_ROOT) return picked;
  return picked.getDirectoryHandle(OWN_ED_ROOT, { create: true });
}

export function getFolderConnectionState(): FolderConnectionState {
  return {
    connected: directoryHandle !== null,
    name: directoryHandle?.name,
    lastSyncAt: lastFolderSyncAt,
  };
}

export async function chooseLocalFolder(): Promise<FolderConnectionState> {
  if (!("showDirectoryPicker" in window)) {
    throw new Error("File System Access API is not supported in this browser");
  }
  const picked = await (
    window as Window & {
      showDirectoryPicker: (opts?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
    }
  ).showDirectoryPicker({ mode: "readwrite" });
  const root = await getOrCreateOwnEdRoot(picked);
  await ensureSubfolders(root);
  directoryHandle = root;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(FOLDER_NAME_KEY, root.name);
  }
  return getFolderConnectionState();
}

export async function reconnectLocalFolder(): Promise<FolderConnectionState> {
  return chooseLocalFolder();
}

export function disconnectLocalFolder(): void {
  directoryHandle = null;
  lastFolderSyncAt = undefined;
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(FOLDER_NAME_KEY);
  }
}

async function writeTextFile(
  root: FileSystemDirectoryHandle,
  relativePath: string,
  contents: string
): Promise<void> {
  const parts = relativePath.split("/");
  const filename = parts.pop()!;
  let dir = root;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create: true });
  }
  const handle = await dir.getFileHandle(filename, { create: true });
  const writable = await handle.createWritable();
  await writable.write(contents);
  await writable.close();
}

async function writeBlobFile(
  root: FileSystemDirectoryHandle,
  relativePath: string,
  blob: Blob
): Promise<void> {
  const parts = relativePath.split("/");
  const filename = parts.pop()!;
  let dir = root;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create: true });
  }
  const handle = await dir.getFileHandle(filename, { create: true });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export async function mirrorPayloadToFolder(payload: LocalDbPayload): Promise<void> {
  if (!directoryHandle) return;

  const root = directoryHandle;
  const { normalized } = payload;

  await writeTextFile(root, "data/assumptions.json", JSON.stringify(normalized.assumptions, null, 2));
  await writeTextFile(root, "data/products.json", JSON.stringify(normalized.products, null, 2));
  await writeTextFile(root, "data/schedule.json", JSON.stringify(normalized.schedule, null, 2));
  await writeTextFile(root, "data/scenarios.json", JSON.stringify(normalized.scenarios, null, 2));
  await writeTextFile(root, "data/studios.json", JSON.stringify(normalized.studios, null, 2));
  await writeTextFile(root, "data/roadmap.json", JSON.stringify(normalized.roadmap, null, 2));
  await writeTextFile(root, "data/brand-items.json", JSON.stringify(payload.extensions.brandItems, null, 2));
  await writeTextFile(root, "data/space-images.json", JSON.stringify(payload.extensions.spaceImages, null, 2));

  const backup: OwnedBackupV1 = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    appVersion: "0.1.0",
    data: normalized,
    assetMetadata: normalized.assets,
  };
  const backupJson = JSON.stringify(backup, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  await writeTextFile(root, `backups/owned-backup-latest.json`, backupJson);
  await writeTextFile(root, `backups/owned-backup-${date}.json`, backupJson);

  const blobs = await listAssetBlobs();
  for (const asset of blobs) {
    const rel =
      asset.filesystemRelativePath ??
      (asset.category.startsWith("brand")
        ? `brand/images/${asset.filename}`
        : asset.category === "floor-plan"
          ? `space/floor-plans/${asset.filename}`
          : asset.category === "moodboard"
            ? `space/moodboards/${asset.filename}`
            : `space/uploads/${asset.filename}`);
    try {
      await writeBlobFile(root, rel, asset.blob);
    } catch {
      // Folder write failure must not block IndexedDB
    }
  }

  lastFolderSyncAt = new Date().toISOString();
}

export async function writeAssetToFolder(
  relativePath: string,
  blob: Blob
): Promise<boolean> {
  if (!directoryHandle) return false;
  try {
    await writeBlobFile(directoryHandle, relativePath, blob);
    lastFolderSyncAt = new Date().toISOString();
    return true;
  } catch {
    return false;
  }
}

/** Restore folder name hint from localStorage (handle itself cannot persist across sessions without permission) */
export function getStoredFolderName(): string | undefined {
  if (typeof localStorage === "undefined") return undefined;
  return localStorage.getItem(FOLDER_NAME_KEY) ?? undefined;
}
