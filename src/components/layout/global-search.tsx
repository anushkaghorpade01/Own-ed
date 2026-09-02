"use client";

import { useState, useMemo } from "react";
import { useApp } from "@/lib/store/app-store";
import { Search } from "lucide-react";

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const { state } = useApp();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const items: Array<{ type: string; title: string; href: string }> = [];

    state.studios.forEach((s) => {
      if (s.name.toLowerCase().includes(q) || s.location?.toLowerCase().includes(q)) {
        items.push({ type: "Studio", title: s.name, href: "/studios" });
      }
    });
    state.decisions.forEach((d) => {
      if (d.title.toLowerCase().includes(q) || d.decision.toLowerCase().includes(q)) {
        items.push({ type: "Decision", title: d.title, href: "/" });
      }
    });
    state.scenarios.forEach((s) => {
      if (s.name.toLowerCase().includes(q)) {
        items.push({ type: "Scenario", title: s.name, href: "/math/scenarios" });
      }
    });
    state.libraryItems.forEach((l) => {
      if (l.title.toLowerCase().includes(q)) {
        items.push({ type: "Library", title: l.title, href: "/library" });
      }
    });
    state.questions.forEach((q_) => {
      if (q_.question.toLowerCase().includes(q)) {
        items.push({ type: "Question", title: q_.question, href: "/" });
      }
    });

    return items.slice(0, 12);
  }, [query, state]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 pt-[15vh] backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-[#E8E2D9] bg-[#FAF8F5] shadow-xl">
        <div className="flex items-center gap-3 border-b border-[#E8E2D9] px-4 py-3">
          <Search className="h-4 w-4 text-[#A39E98]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search studios, decisions, scenarios…"
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
        <ul className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && query && (
            <li className="px-3 py-6 text-center text-sm text-[#A39E98]">No results</li>
          )}
          {results.map((r, i) => (
            <li key={i}>
              <a
                href={r.href}
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-[#F0EBE3]"
              >
                <span className="text-[10px] font-medium uppercase tracking-wider text-[#A39E98]">
                  {r.type}
                </span>
                <span className="text-[#2C2825]">{r.title}</span>
              </a>
            </li>
          ))}
        </ul>
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
