"use client";
import {getRecoveryCopy,recoveryBackup} from "@/lib/data/local/recovery";
import {mergeFinanceHistory,financeMergeCounts} from '@/lib/finance/current/merge';

/* eslint-disable react-hooks/set-state-in-effect -- Existing state synchronization; requires a separate behavioral refactor. */

import { useRef, useState, useEffect } from "react";
import { useApp } from "@/lib/store/app-store";
import { persistenceService } from "@/lib/data/local/persistence-service";
import {
  exportOwnedBackup,
  downloadJsonBackup,
  parseBackupFile,
  backupToAppState,
} from "@/lib/data/local/backup";
import { supportsFileSystemAccess } from "@/lib/data/local/capabilities";
import { SectionHeader } from "@/components/shared/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function DataSettingsPage() {
  const { state, lastSaved, saveStatus, persistenceStats } = useApp();
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | undefined>();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const fsSupported = supportsFileSystemAccess();

  async function exportOriginal(){try{const copy=await getRecoveryCopy();if(!copy){setMessage('No pre-update recovery copy is present in this browser. Current backup remains available.');return;}const backup=recoveryBackup(copy);if(backup)downloadJsonBackup(backup,'OWN-original-before-cohort-update.json');else{const blob=new Blob([JSON.stringify(copy,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='OWN-original-storage-recovery.json';a.click();URL.revokeObjectURL(url);}setMessage('First state seen by this update downloaded, including legacy app/financial raw strings. Existing asset blobs are not included in this records-only copy. The recovery copy survives the in-app Clear local data action; clearing site storage in the browser can still erase it.');}catch(e){setMessage(String(e));}}
  async function refreshGoogleStatus() {
    try {
      const res = await fetch("/api/auth/google/status");
      if (!res.ok) return;
      const data = (await res.json()) as { connected?: boolean; email?: string };
      setGoogleConnected(!!data.connected);
      setGoogleEmail(data.email);
    } catch {
      setGoogleConnected(false);
    }
  }

  useEffect(() => {
    refreshGoogleStatus();
  }, []);

  async function handleChooseFolder() {
    setBusy("folder");
    setMessage(null);
    try {
      const conn = await persistenceService.chooseFolder();
      setMessage(`Folder connected: ${conn.name ?? "Own-ed"}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not connect folder");
    } finally {
      setBusy(null);
    }
  }

  async function handleSyncFolder() {
    setBusy("sync");
    try {
      await persistenceService.syncFolderNow(state);
      setMessage("Folder sync complete");
    } catch {
      setMessage("Saved locally. Folder backup couldn't be updated.");
    } finally {
      setBusy(null);
    }
  }

  async function handleExport() {
    setBusy("export");
    try {
      const backup = await exportOwnedBackup(state);
      downloadJsonBackup(backup);
      setMessage("Backup downloaded");
    } finally {
      setBusy(null);
    }
  }

  async function handleImport(file: File, mode: "replace" | "merge") {
    setBusy("import");
    try {
      const backup = await parseBackupFile(file);
      const imported = backupToAppState(backup);
      if (mode === "replace") {
        await persistenceService.replaceFromPayload(imported);
        window.location.reload();
      } else {
        await persistenceService.replaceFromPayload({
          ...state,
          ...imported,
          currentFinance: mergeFinanceHistory(state.currentFinance,imported.currentFinance),
          productConcepts: [...new Map([...imported.productConcepts,...state.productConcepts].map(r=>[r.id,r])).values()],
          programmingItems: [...new Map([...imported.programmingItems,...state.programmingItems].map(r=>[r.id,r])).values()],
          studios: [...new Map([...imported.studios,...state.studios].map(r=>[r.id,r])).values()],
          brandItems: [...new Map([...imported.brandItems,...state.brandItems].map(r=>[r.id,r])).values()],
          spaceImages: state.spaceImages,
          libraryItems: [...new Map([...imported.libraryItems,...state.libraryItems].map(r=>[r.id,r])).values()],
          snapshots: [...new Map([...imported.snapshots,...state.snapshots].map(r=>[r.id,r])).values()],
          scenarios: [...state.scenarios, ...imported.scenarios],
          decisions: [...state.decisions, ...imported.decisions],
        });
        const counts=financeMergeCounts(state.currentFinance,imported.currentFinance);setMessage(`Financial records added: ${counts.added}; same-month / same-ID conflicts skipped: ${counts.skipped}. Backup merged. Current financial baseline, existing same-month actuals and same-ID history, and Space records were preserved. Nonconflicting financial history was added. Reload to see merged records.`);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleClearBrowserData() {
    if (
      !window.confirm(
        "This removes current Own-ed records and uploaded files from this browser. The first-state records-only recovery copy stays, but contains no uploaded file binaries. Files in a connected folder are not deleted. A retained legacy localStorage fallback may be restored on reload. Export a backup before continuing. Continue?"
      )
    ) {
      return;
    }
    await persistenceService.clearLocalData({ includeAssets: true });
    window.location.reload();
  }

  const stats = persistenceStats;

  return (
    <div>
      <SectionHeader
        title="Data & Backups"
        description="Current financial plan, actuals and snapshots are included with your workspace in local backups. Google and folder sync are optional."
      />

      {message && (
        <p className="mb-4 rounded-lg border border-[#E8E2D9] bg-white p-3 text-sm text-[#6B6560]">
          {message}
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge variant="default">Saved on this device</Badge>
        <Badge variant={saveStatus === "error" ? "danger" : "outline"}>
          {saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Save error" : "Healthy"}
        </Badge>
        {stats?.folderConnected && <Badge variant="secondary">Folder connected</Badge>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Local database</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-[#6B6560]">
            <p>
              Your Own-ed data is stored in this browser on this device using IndexedDB — no cloud
              account required.
            </p>
            <ul className="space-y-1 text-xs">
              <li>Records: {stats?.recordCount ?? "—"}</li>
              <li>Assets: {stats?.assetCount ?? "—"}</li>
              <li>
                Last local save:{" "}
                {lastSaved ? format(new Date(lastSaved), "d MMM yyyy, h:mm a") : "—"}
              </li>
              <li>Schema version: {stats?.schemaVersion ?? 1}</li>
            </ul>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={handleExport} disabled={!!busy}>
                Export backup
              </Button>
              <Button variant="outline" onClick={exportOriginal}>Export first saved state seen by this update</Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => importRef.current?.click()}
                disabled={!!busy}
              >
                Import backup
              </Button>
              <input
                ref={importRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const replace = window.confirm(
                    "Replace current data with backup?\n\nOK = Replace\nCancel = Merge"
                  );
                  handleImport(file, replace ? "replace" : "merge");
                  e.target.value = "";
                }}
              />
              <Button variant="outline" size="sm" onClick={handleClearBrowserData} disabled={!!busy}>
                Clear local data
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Local Own-ed folder</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-[#6B6560]">
            {fsSupported ? (
              <>
                <p>
                  Choose a folder on your computer. Own-ed will create an <strong>Own-ed/</strong>{" "}
                  structure inside it for JSON mirrors and uploaded files.
                </p>
                <p className="text-xs">
                  Status:{" "}
                  {stats?.folderConnected
                    ? `Connected (${stats.folderName ?? "Own-ed"})`
                    : stats?.folderName
                      ? `Disconnected — was ${stats.folderName}`
                      : "Not connected"}
                </p>
                {stats?.lastFolderSyncAt && (
                  <p className="text-xs">
                    Last folder sync:{" "}
                    {format(new Date(stats.lastFolderSyncAt), "d MMM yyyy, h:mm a")}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" onClick={handleChooseFolder} disabled={!!busy}>
                    {stats?.folderConnected ? "Reconnect folder" : "Choose folder"}
                  </Button>
                  {stats?.folderConnected && (
                    <Button variant="outline" size="sm" onClick={handleSyncFolder} disabled={!!busy}>
                      Sync now
                    </Button>
                  )}
                  {stats?.folderConnected && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => persistenceService.disconnectFolder()}
                    >
                      Disconnect
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <p>
                Direct folder sync isn&apos;t supported in this browser. Your data is still saved
                locally. Use Export backup instead.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Optional cloud backup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[#6B6560]">
            <p>
              Google Sheets and Drive are optional — Own-ed works fully without them. Connect only
              if you want a cloud copy.
            </p>
            <Badge variant={googleConnected ? "default" : "outline"}>
              Google: {googleConnected ? `Connected${googleEmail ? ` (${googleEmail})` : ""}` : "Not connected"}
            </Badge>
            <div className="flex flex-wrap gap-2">
              {!googleConnected ? (
                <Button variant="outline" size="sm" onClick={() => { window.location.href = "/api/auth/google"; }}>
                  Connect Google (optional)
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await fetch("/api/sync", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ legacyState: state }),
                      });
                      setMessage("Cloud sync complete");
                    }}
                  >
                    Sync to Google
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await fetch("/api/auth/google/status", { method: "DELETE" });
                      await refreshGoogleStatus();
                    }}
                  >
                    Disconnect Google
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
