"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  Home,
  Calculator,
  LayoutGrid,
  Building2,
  Dumbbell,
  Lightbulb,
  Palette,
  Map,
  Library,
  Search,
  BookOpen,
  Undo2,
} from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useApp } from "@/lib/store/app-store";
import { GlobalSearch } from "./global-search";
import { AskOwnedPanel } from "@/components/ask-owned/ask-owned-panel";
import { ExportMenu } from "@/components/export/export-menu";
import { LocalSaveStatus } from "./local-save-status";
import { useState, useEffect } from "react";
import { MessageCircleQuestion } from "lucide-react";

const mainNav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/math", label: "Math", icon: Calculator },
  { href: "/space", label: "Space", icon: LayoutGrid },
  { href: "/studios", label: "Studios", icon: Building2 },
  { href: "/programming", label: "Programming", icon: Dumbbell },
  { href: "/product", label: "Product", icon: Lightbulb },
  { href: "/brand", label: "Brand", icon: Palette },
  { href: "/roadmap", label: "Roadmap", icon: Map },
  { href: "/library", label: "Library", icon: Library },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { undo } = useApp();
  const [searchOpen, setSearchOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const isMath = pathname.startsWith("/math");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo]);

  return (
    <Tooltip.Provider delayDuration={200} skipDelayDuration={0}>
    <div className="min-h-screen bg-[#FAF8F5]">
      <header className="sticky top-0 z-40 border-b border-[#E8E2D9]/80 bg-[#FAF8F5]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
          <Link href="/" className="font-wordmark text-xl tracking-tight text-[#2C2825]">
            Own-ed
          </Link>
          <div className="flex items-center gap-2">
            <ExportMenu />
            <button
              type="button"
              onClick={() => setAskOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[#E0DAD2] bg-white/60 px-3 py-1.5 text-xs font-semibold text-[#2C2825] hover:border-[#C4A882]/40"
            >
              <MessageCircleQuestion className="h-3.5 w-3.5" />
              Ask OWNED
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-[#E0DAD2] bg-white/60 px-3 py-1.5 text-xs text-[#A39E98] hover:border-[#C4A882]/40"
            >
              <Search className="h-3.5 w-3.5" />
              Search
              <kbd className="rounded bg-[#F0EBE3] px-1.5 py-0.5 text-[10px]">⌘K</kbd>
            </button>
            <button
              type="button"
              onClick={undo}
              className="rounded-lg p-2 text-[#A39E98] hover:bg-[#F0EBE3] hover:text-[#2C2825]"
              title="Undo (⌘Z)"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <LocalSaveStatus />
            <Link
              href="/guide"
              className={cn(
                "hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold sm:flex",
                pathname.startsWith("/guide")
                  ? "bg-[#2C2825] text-[#FAF8F5]"
                  : "text-[#2C2825] hover:bg-[#F0EBE3]"
              )}
            >
              <BookOpen className="h-4 w-4" />
              Guide
            </Link>
            <Link
              href="/settings/data"
              className="hidden rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[#2C2825] hover:bg-[#F0EBE3] sm:block"
            >
              Data
            </Link>
          </div>
        </div>
        <nav className="mx-auto max-w-[1400px] overflow-x-auto px-6 pb-3">
          <ul className="flex gap-1">
            {mainNav.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "bg-[#2C2825] text-[#FAF8F5]"
                        : "text-[#6B6560] hover:bg-[#F0EBE3] hover:text-[#2C2825]"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <main className={cn("mx-auto max-w-[1400px] px-[var(--space-page-x)] py-[var(--space-page-y)]", isMath && "max-w-[1500px]")}>{children}</main>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <AskOwnedPanel open={askOpen} onOpenChange={setAskOpen} />
    </div>
    </Tooltip.Provider>
  );
}
