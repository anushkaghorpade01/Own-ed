"use client";

import { useDeferredValue, useMemo } from "react";
import { useApp } from "@/lib/store/app-store";
import { runFinanceModel } from "@/lib/finance";

export function useFinanceModel() {
  const { state } = useApp();
  const deferredAssumptions = useDeferredValue(state.assumptions);
  return useMemo(
    () => runFinanceModel(deferredAssumptions),
    [deferredAssumptions]
  );
}

/** True while typed inputs haven't caught up to the displayed model */
export function useFinanceModelStale() {
  const { state } = useApp();
  const deferredAssumptions = useDeferredValue(state.assumptions);
  return deferredAssumptions !== state.assumptions;
}
