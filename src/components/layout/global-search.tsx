"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store/app-store";
import { Search } from "lucide-react";
import {
  searchGlobal,
  groupSearchResults,
  POPULAR_SEARCHES,
  type GlobalSearchResult,
} from "@/lib/search/global-search-index";

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const { state } = useApp();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => searchGlobal(query, state), [query, state]);
  const grouped = useMemo(() => groupSearchResults(results), [results]);
  const flatResults = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const navigate = useCallback(
    (result: GlobalSearchResult) => {
      onOpenChange(false);
      router.push(result.href);
    },
    [onOpenChange, router]
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
        return;
      }
      if (flatResults.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % flatResults.length);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + flatResults.length) % flatResults.length);
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const hit = flatResults[activeIndex];
        if (hit) navigate(hit);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, flatResults, activeIndex, navigate, onOpenChange]);

  if (!open) return null;

  let runningIndex = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 pt-[12vh] backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-xl border border-[#E8E2D9] bg-[#FAF8F5] shadow-xl">
        <div className="flex items-center gap-3 border-b border-[#E8E2D9] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[#A39E98]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, assumptions, guide, dictionary…"
            className="flex-1 bg-transparent text-sm text-[#2C2825] outline-none placeholder:text-[#A39E98]"
          />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-xs text-[#A39E98] hover:text-[#6B6560]"
          >
            Esc
          </button>
        </div>

        <div className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
          {!query.trim() && (
            <div className="px-3 py-4">
              <p className="text-xs font-medium uppercase tracking-wider text-[#A39E98]">
                Popular searches
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {POPULAR_SEARCHES.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setQuery(term)}
                    className="rounded-full border border-[#E0DAD2] bg-white px-3 py-1 text-xs text-[#2C2825] hover:border-[#C4A882]/50"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {query.trim() && flatResults.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-[#A39E98]">
              No matches for &ldquo;{query}&rdquo;. Try occupancy, rent, or P&amp;L.
            </p>
          )}

          {grouped.map(({ category, items }) => (
            <div key={category} className="mb-2">
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#A39E98]">
                {category}
              </p>
              <ul>
                {items.map((result) => {
                  const index = runningIndex++;
                  const active = index === activeIndex;
                  return (
                    <li key={result.id}>
                      <Link
                        href={result.href}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(result);
                        }}
                        className={`flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                          active ? "bg-[#E8E2D9]" : "hover:bg-[#F0EBE3]"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-[#2C2825]">{result.title}</p>
                          {result.subtitle && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-[#6B6560]">
                              {result.subtitle}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-[#A39E98]">
                          Go →
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="fixed inset-0 -z-10"
        onClick={() => onOpenChange(false)}
        aria-label="Close search"
      />
    </div>
  );
}
