"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { GUIDE_GROUPS, GUIDE_VERSION, type GuideSection } from "@/content/guide";
import { searchGuide, highlightParts, type GuideSearchResult } from "@/lib/guide/search";
import { Menu, X } from "lucide-react";

function GuideSectionView({
  section,
  highlightQuery,
}: {
  section: GuideSection;
  highlightQuery?: string;
}) {
  return (
    <article
      id={section.id}
      className="scroll-mt-28 border-b border-[var(--border-subtle)] pb-8 last:border-0"
    >
      <h2 className="text-h2 text-[var(--text-primary)]">{section.title}</h2>
      <p className="text-caption mt-1 text-[var(--text-muted)]">{section.category}</p>

      <div className="mt-4 space-y-3 text-body-sm text-[var(--text-secondary)]">
        {section.body.map((para, i) => (
          <p key={i}>
            {highlightQuery
              ? highlightParts(para, highlightQuery).map((part, j) =>
                  part.highlight ? (
                    <mark
                      key={j}
                      className="rounded bg-amber-100 px-0.5 text-[var(--text-primary)]"
                    >
                      {part.text}
                    </mark>
                  ) : (
                    <span key={j}>{part.text}</span>
                  )
                )
              : para}
          </p>
        ))}
      </div>

      {section.payAttention && section.payAttention.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2">
          <p className="text-label text-amber-900">Pay attention to</p>
          <ul className="mt-1 list-inside list-disc text-body-sm text-amber-950">
            {section.payAttention.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {section.related && section.related.length > 0 && (
        <p className="text-body-sm mt-4 text-[var(--text-muted)]">
          Related:{" "}
          {section.related.map((r, i) => (
            <span key={r.id}>
              {i > 0 && " · "}
              <a href={`#${r.id}`} className="text-[var(--accent)] underline-offset-2 hover:underline">
                {r.label}
              </a>
            </span>
          ))}
        </p>
      )}
    </article>
  );
}

function SidebarNav({
  activeId,
  onNavigate,
  className,
}: {
  activeId: string | null;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <nav className={cn("space-y-4", className)}>
      {GUIDE_GROUPS.map((group) => (
        <div key={group.category}>
          <p className="text-label mb-1">{group.category}</p>
          <ul className="space-y-0.5">
            {group.sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={onNavigate}
                  className={cn(
                    "block rounded-md px-2 py-1 text-body-sm transition-colors",
                    activeId === s.id
                      ? "bg-[var(--surface-muted)] font-medium text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]/60"
                  )}
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function GuidePageClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GuideSearchResult[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [focusedSection, setFocusedSection] = useState<string | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setResults(searchGuide(query));
  }, [query]);

  // Hash navigation on load and hash change
  useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (!hash) return;
      setFocusedSection(hash);
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  // Intersection observer for active sidebar
  useEffect(() => {
    const ids = GUIDE_GROUPS.flatMap((g) => g.sections.map((s) => s.id));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [focusedSection, query]);

  const handleResultClick = useCallback((id: string) => {
    setQuery("");
    setResults([]);
    setFocusedSection(id);
    window.history.pushState(null, "", `#${id}`);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const sectionsToShow =
    query.trim() && results.length > 0
      ? results.map((r) => r.section)
      : GUIDE_GROUPS.flatMap((g) => g.sections);

  const highlightQuery = query.trim() || undefined;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-h1 text-[var(--text-primary)]">Own-ed Guide</h1>
        <p className="text-body-sm mt-1 text-[var(--text-secondary)]">
          First-time help for planning your studio — search or browse below.
        </p>
        <p className="text-caption mt-2 text-[var(--text-muted)]">Last updated: {GUIDE_VERSION}</p>

        <div className="relative mt-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the guide… e.g. cash, 8-pack, occupancy, brand"
            className="w-full rounded-lg border border-[var(--border-default)] bg-white px-4 py-2.5 text-body-sm shadow-sm outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            aria-label="Search the guide"
          />
          {query.trim() && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-[var(--border-default)] bg-white shadow-lg">
              {results.length === 0 ? (
                <p className="p-4 text-body-sm text-[var(--text-muted)]">
                  No guide results for &ldquo;{query}&rdquo;. Check spelling or browse the index
                  below.
                </p>
              ) : (
                <ul>
                  {results.map((r) => (
                    <li key={r.section.id}>
                      <button
                        type="button"
                        className="w-full px-4 py-3 text-left hover:bg-[var(--surface-muted)]"
                        onClick={() => handleResultClick(r.section.id)}
                      >
                        <p className="text-body-sm font-medium text-[var(--text-primary)]">
                          {r.section.title}
                        </p>
                        <p className="text-caption text-[var(--text-muted)]">{r.section.category}</p>
                        <p className="text-caption mt-1 line-clamp-2 text-[var(--text-secondary)]">
                          {highlightParts(r.snippet, query).map((part, i) =>
                            part.highlight ? (
                              <mark key={i} className="bg-amber-100">{part.text}</mark>
                            ) : (
                              <span key={i}>{part.text}</span>
                            )
                          )}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="lg:flex lg:gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden w-52 shrink-0 lg:block">
          <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
            <SidebarNav activeId={activeId} />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Mobile contents toggle */}
          <div className="mb-4 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileNav(true)}
              className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] px-3 py-2 text-body-sm"
            >
              <Menu className="h-4 w-4" /> Contents
            </button>
          </div>

          <div ref={mainRef} className="space-y-2">
            {query.trim() && results.length > 0 && (
              <p className="text-body-sm text-[var(--text-muted)] mb-4">
                Showing {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{query}
                &rdquo; —{" "}
                <button type="button" className="underline" onClick={() => setQuery("")}>
                  show full guide
                </button>
              </p>
            )}

            {sectionsToShow.map((section) => (
              <GuideSectionView
                key={section.id}
                section={section}
                highlightQuery={
                  focusedSection === section.id ||
                  results.some((r) => r.section.id === section.id)
                    ? highlightQuery
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      </div>

      {mobileNav && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/20"
            aria-label="Close contents"
            onClick={() => setMobileNav(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85vw] overflow-y-auto bg-[#FAF8F5] p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-label">Contents</p>
              <button type="button" onClick={() => setMobileNav(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav activeId={activeId} onNavigate={() => setMobileNav(false)} />
          </div>
        </div>
      )}

      <footer className="mt-12 border-t border-[var(--border-subtle)] pt-4 text-center text-caption text-[var(--text-muted)]">
        Questions about a specific number? Use <Link href="/math/dictionary" className="underline">Dictionary</Link> or Ask OWNED.
      </footer>
    </div>
  );
}
