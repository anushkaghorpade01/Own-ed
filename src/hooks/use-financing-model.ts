"use client";

import { useMemo } from "react";
import { useApp } from "@/lib/store/app-store";
import { runFinanceModel } from "@/lib/finance";
import { useSectionContextOptional } from "@/components/finance/assumption-section";
import type { FinanceAssumptions } from "@/lib/finance/schemas";

type FinancingDraft = Partial<
  Pick<
    FinanceAssumptions,
    "founderEquity" | "loanAmount" | "loanInterestRatePct" | "loanTermMonths" | "loanGracePeriodMonths"
  >
>;

/**
 * Financing summary uses section draft when inside Assumptions → Financing,
 * so cards update immediately as the founder edits (no stale committed value).
 */
export function useFinancingModel() {
  const { state } = useApp();
  const section = useSectionContextOptional<FinancingDraft>();

  const assumptions = useMemo(() => {
    if (!section) return state.assumptions;
    return { ...state.assumptions, ...section.draft };
  }, [state.assumptions, section]);

  return useMemo(() => runFinanceModel(assumptions), [assumptions]);
}

export function useFinancingDraftDirty() {
  const section = useSectionContextOptional<FinancingDraft>();
  return section?.dirty ?? false;
}
