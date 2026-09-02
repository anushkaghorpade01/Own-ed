"use client";

import { useCallback, useEffect, useState } from "react";
import type { PendingWrite, SyncStatus } from "../types";

const QUEUE_KEY = "owned-sync-queue-v1";

export class LocalSyncQueueRepository {
  private queue: PendingWrite[] = [];

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(QUEUE_KEY);
        this.queue = raw ? JSON.parse(raw) : [];
      } catch {
        this.queue = [];
      }
    }
  }

  private persist() {
    if (typeof window !== "undefined") {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    }
  }

  async enqueue(op: PendingWrite): Promise<void> {
    this.queue.push(op);
    this.persist();
  }

  async listPending(): Promise<PendingWrite[]> {
    return [...this.queue];
  }

  async markSynced(ids: string[]): Promise<void> {
    const set = new Set(ids);
    this.queue = this.queue.filter((q) => !set.has(q.id));
    this.persist();
  }

  async markFailed(id: string, error: string): Promise<void> {
    const item = this.queue.find((q) => q.id === id);
    if (item) {
      item.retryCount += 1;
      item.lastError = error;
      this.persist();
    }
  }

  get pendingCount(): number {
    return this.queue.length;
  }
}

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>("saved");
  const [connected, setConnected] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/google/status");
      const data = await res.json();
      setConnected(!!data.connected);
      setStatus(data.syncStatus ?? "offline");
    } catch {
      setConnected(false);
      setStatus("offline");
    }
    const queue = new LocalSyncQueueRepository();
    setPendingCount(queue.pendingCount);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const syncNow = useCallback(
    async (legacyState?: unknown) => {
      setStatus("saving");
      try {
        const res = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ legacyState }),
        });
        if (!res.ok) throw new Error("Sync failed");
        setStatus("saved");
        await refresh();
        return await res.json();
      } catch {
        setStatus("error");
        throw new Error("Sync failed");
      }
    },
    [refresh]
  );

  return { status, connected, pendingCount, syncNow, refresh };
}
