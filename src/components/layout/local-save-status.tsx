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
          "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
          saveStatus === "error"
            ? "bg-red-100 text-red-800"
            : saveStatus === "saving"
              ? "bg-amber-100 text-amber-900 animate-pulse"
              : "bg-emerald-100 text-emerald-800"
        )}
        title="Your Own-ed data is stored in this browser on this device."
      >
        {saveStatus === "error" ? "Save error" : "Local"}
      </span>
      <span className="hidden text-[10px] text-[#A39E98] sm:inline">{label}</span>
      {persistenceStats?.folderConnected && (
        <span className="hidden text-[10px] text-[#A39E98] md:inline">
          + Folder connected
        </span>
      )}
    </div>
  );
}
