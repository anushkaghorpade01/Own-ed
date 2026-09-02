/**
 * Client-side backup export/import — no server or Google required.
 */
import type { LocalDbPayload, OwnedBackupV1 } from "../types";
import { appStateToPayload, payloadToAppState } from "./app-state-bridge";
import type { AppState } from "@/lib/store/app-state";
import { listAssetBlobs } from "./asset-store";

export async function exportOwnedBackup(state: AppState): Promise<OwnedBackupV1> {
  const payload = appStateToPayload(state);
  const assetMetadata = await listAssetBlobs().then((blobs) =>
    blobs.map((b) => ({
      assetId: b.assetId,
      filename: b.filename,
      mimeType: b.mimeType,
      category: b.category,
      localBlobId: b.assetId,
      filesystemRelativePath: b.filesystemRelativePath,
      linkedEntityType: b.linkedEntityType,
      linkedEntityId: b.linkedEntityId,
      sourceUrl: b.sourceUrl,
      tags: [],
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }))
  );

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    appVersion: "0.1.0",
    data: payload.normalized,
    assetMetadata,
  };
}

export function downloadJsonBackup(backup: OwnedBackupV1, filename?: string): void {
  const name =
    filename ?? `owned-backup-v1-${backup.exportedAt.slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function validateBackup(data: unknown): data is OwnedBackupV1 {
  if (!data || typeof data !== "object") return false;
  const b = data as OwnedBackupV1;
  return b.schemaVersion === 1 && !!b.data && typeof b.exportedAt === "string";
}

export function backupToAppState(backup: OwnedBackupV1): AppState {
  const payload: LocalDbPayload = {
    schemaVersion: 1,
    normalized: backup.data,
    extensions: {
      mathReviewItems: [],
      productConcepts: [],
      programmingItems: [],
      brandItems: [],
      spaceImages: backup.data.assets
        .filter((a) => a.category === "moodboard")
        .map((a) => ({
          id: a.assetId,
          board: a.linkedEntityId ?? "Overall",
          title: a.filename,
          imageUrl: a.sourceUrl ?? "",
          sourceUrl: a.sourceUrl,
          itemType: a.mimeType?.startsWith("image/") ? "image" : "link",
          tags: a.tags,
          notes: a.notes,
          isSample: false,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
        })),
      productVersionHistory: {},
    },
    savedAt: backup.exportedAt,
  };
  return payloadToAppState(payload);
}

export async function parseBackupFile(file: File): Promise<OwnedBackupV1> {
  const text = await file.text();
  const parsed = JSON.parse(text) as unknown;
  if (!validateBackup(parsed)) {
    throw new Error("Invalid Own-ed backup file — expected schemaVersion 1");
  }
  return parsed;
}
