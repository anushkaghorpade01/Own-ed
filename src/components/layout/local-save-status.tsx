"use client";

import { useApp } from "@/lib/store/app-store";
import { cn } from "@/lib/cn";
import { format } from "date-fns";

export function LocalSaveStatus() {
  const { saveStatus, lastSaved, persistenceStats } = useApp();

  const label =
    saveStatus === "saving"
      ? "Saving…"
      : saveStatus === "error"
        ? "Couldn't save locally"
        : lastSaved
          ? `Saved locally • ${format(new Date(lastSaved), "h:mm a")}`
          : "Saved on this device";

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide",
          saveStatus === "error"
            ? "bg-red-100 text-red-800"
            : saveStatus === "saving"
              ? "bg-amber-100 text-amber-900 animate-pulse"
              : "bg-emerald-100 text-emerald-900"
        )}
        title="Your Own-ed data is stored in this browser on this device."
      >
        {saveStatus === "error" ? "Save error" : "Local"}
      </span>
      <span className="hidden text-sm font-semibold text-[#2C2825] sm:inline">{label}</span>
      {persistenceStats?.folderConnected && (
        <span className="hidden text-sm font-medium text-[#6B6560] md:inline">
          + Folder connected
        </span>
      )}
    </div>
  );
}
