"use client";

import { useFinanceModelStale } from "@/hooks/use-finance-model";

/** Subtle indicator while finance model catches up to typed inputs */
export function ModelUpdatingIndicator() {
  const stale = useFinanceModelStale();
  if (!stale) return null;
  return (
    <span className="text-caption animate-pulse text-[var(--text-muted)]" aria-live="polite">
      Updating…
    </span>
  );
}
