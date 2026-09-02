"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type AssumptionsSearchContextValue = {
  query: string;
  sectionWideMatch: boolean;
};

const AssumptionsSearchContext = createContext<AssumptionsSearchContextValue>({
  query: "",
  sectionWideMatch: true,
});

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function textMatchesSearch(text: string, query: string): boolean {
  const q = normalizeSearchQuery(query);
  if (!q) return true;
  return text.toLowerCase().includes(q);
}

export function sectionMatchesSearch(
  title: string,
  keywords: string[],
  query: string
): boolean {
  const q = normalizeSearchQuery(query);
  if (!q) return true;
  if (textMatchesSearch(title, q)) return true;
  return keywords.some((keyword) => textMatchesSearch(keyword, q));
}

export function AssumptionsSearchProvider({
  query,
  sectionWideMatch,
  children,
}: {
  query: string;
  sectionWideMatch: boolean;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ query, sectionWideMatch }),
    [query, sectionWideMatch]
  );
  return (
    <AssumptionsSearchContext.Provider value={value}>
      {children}
    </AssumptionsSearchContext.Provider>
  );
}

export function useAssumptionsFieldVisible(label: string): boolean {
  const { query, sectionWideMatch } = useContext(AssumptionsSearchContext);
  if (!normalizeSearchQuery(query)) return true;
  if (sectionWideMatch) return true;
  return textMatchesSearch(label, query);
}

export function AssumptionsSearchBar({
  value,
  onChange,
  resultCount,
}: {
  value: string;
  onChange: (value: string) => void;
  resultCount?: number;
}) {
  const active = normalizeSearchQuery(value).length > 0;

  return (
    <div className="mb-4 space-y-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A39E98]"
          aria-hidden
        />
        <Input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search assumptions — e.g. rent, reformers, GST, ramp-up…"
          className="h-10 pl-9 pr-10"
          aria-label="Search assumptions"
        />
        {active && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 p-0 text-[#A39E98]"
            onClick={() => onChange("")}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {active && (
        <p className="text-xs text-[#6B6560]">
          {resultCount === 0
            ? "No matching sections — try a different term."
            : `Showing ${resultCount} matching section${resultCount === 1 ? "" : "s"}.`}
        </p>
      )}
    </div>
  );
}
