"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { SectionHeader, SampleBanner } from "@/components/shared/metric-card";
import { Input } from "@/components/ui/input";
import {
  DICTIONARY_CATEGORIES,
  FINANCE_DICTIONARY,
  searchDictionary,
  type DictionaryCategory,
} from "@/lib/finance/finance-dictionary";
import { cn } from "@/lib/cn";

export default function DictionaryPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<DictionaryCategory | "all">("all");

  const entries = useMemo(() => {
    const filtered = searchDictionary(query);
    if (category === "all") return filtered;
    return filtered.filter((e) => e.category === category);
  }, [query, category]);

  const grouped = useMemo(() => {
    const map = new Map<DictionaryCategory, typeof entries>();
    for (const e of entries) {
      const list = map.get(e.category) ?? [];
      list.push(e);
      map.set(e.category, list);
    }
    return map;
  }, [entries]);

  return (
    <div>
      <SectionHeader
        title="Dictionary"
        description="Every financial term Own-ed uses — defined for a Pilates reformer studio, not generic accounting."
      />
      <SampleBanner />

      <p className="mb-6 text-sm text-[var(--text-secondary)]">
        Own-ed is a founder planning tool. Terms here match labels on{" "}
        <Link href="/math/pricing" className="underline">
          Pricing
        </Link>
        ,{" "}
        <Link href="/math/pl" className="underline">
          P&L
        </Link>
        ,{" "}
        <Link href="/math/unit-economics" className="underline">
          Unit Economics
        </Link>
        , and{" "}
        <Link href="/math/access-products" className="underline">
          Access Products
        </Link>
        .
      </p>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search terms — e.g. CM1, fully loaded, net sales…"
          className="max-w-md"
        />
        <div className="flex flex-wrap gap-2">
          <FilterChip active={category === "all"} onClick={() => setCategory("all")}>
            All
          </FilterChip>
          {(Object.keys(DICTIONARY_CATEGORIES) as DictionaryCategory[]).map((key) => (
            <FilterChip key={key} active={category === key} onClick={() => setCategory(key)}>
              {DICTIONARY_CATEGORIES[key].label}
            </FilterChip>
          ))}
        </div>
      </div>

      {entries.length === 0 && (
        <p className="text-sm text-[var(--text-muted)]">No terms match your search.</p>
      )}

      <div className="space-y-10">
        {(Object.keys(DICTIONARY_CATEGORIES) as DictionaryCategory[]).map((cat) => {
          const items = grouped.get(cat);
          if (!items?.length) return null;
          const meta = DICTIONARY_CATEGORIES[cat];
          return (
            <section key={cat}>
              <h2 className="text-h2">{meta.label}</h2>
              <p className="text-body-sm mt-1 text-[var(--text-secondary)]">{meta.description}</p>
              <dl className="mt-4 space-y-4">
                {items.map((entry) => (
                  <div
                    key={entry.term}
                    id={slugify(entry.term)}
                    className="card-surface scroll-mt-28"
                  >
                    <dt className="text-h3">{entry.term}</dt>
                    {entry.aliases && entry.aliases.length > 0 && (
                      <p className="text-caption mt-0.5 text-[var(--text-muted)]">
                        Also: {entry.aliases.join(" · ")}
                      </p>
                    )}
                    <dd className="mt-2 space-y-2 text-body-sm text-[var(--text-secondary)]">
                      <p>{entry.definition}</p>
                      {entry.formula && (
                        <p>
                          <span className="font-medium text-[var(--text-primary)]">Formula: </span>
                          <code className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-caption">
                            {entry.formula}
                          </code>
                        </p>
                      )}
                      {entry.example && (
                        <p>
                          <span className="font-medium text-[var(--text-primary)]">Example: </span>
                          {entry.example}
                        </p>
                      )}
                      {entry.usedIn && (
                        <p className="text-caption text-[var(--text-muted)]">Used in: {entry.usedIn}</p>
                      )}
                      {entry.notTheSameAs && (
                        <p className="rounded-lg bg-amber-50 px-3 py-2 text-caption text-amber-950">
                          Not the same as: {entry.notTheSameAs}
                        </p>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
      </div>

      <p className="mt-10 text-caption text-[var(--text-muted)]">
        {FINANCE_DICTIONARY.length} terms · Planning model, not statutory accounting
      </p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-caption font-medium transition-colors",
        active
          ? "bg-[var(--surface-muted)] text-[var(--text-primary)]"
          : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]/60"
      )}
    >
      {children}
    </button>
  );
}

function slugify(term: string) {
  return term.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
