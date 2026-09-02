"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const MATH_NAV = [
  {
    group: "Plan",
    items: [
      { href: "/math", label: "Overview" },
      { href: "/math/scenarios", label: "Scenario Analysis" },
      { href: "/math/sales-target", label: "Sales & Client Target" },
      { href: "/math/optimise", label: "Optimise" },
      { href: "/math/assumptions", label: "Assumptions" },
    ],
  },
  {
    group: "Operate",
    items: [
      { href: "/math/capacity", label: "Capacity" },
      { href: "/math/access-products", label: "Access Products" },
      { href: "/math/pricing", label: "Pricing" },
    ],
  },
  {
    group: "Economics",
    items: [
      { href: "/math/unit-economics", label: "Unit Economics" },
      { href: "/math/pl", label: "P&L" },
      { href: "/math/cash-flow", label: "Cash Flow" },
      { href: "/math/break-even", label: "Break-even" },
      { href: "/math/payback", label: "Investment recovery" },
      { href: "/math/dictionary", label: "Dictionary" },
    ],
  },
  {
    group: "Track",
    items: [
      { href: "/math/review", label: "Math Review" },
      { href: "/math/actuals", label: "Actuals" },
      { href: "/math/snapshots", label: "Snapshots" },
    ],
  },
];

export function MathNav({ compact }: { compact?: boolean }) {
  const pathname = usePathname();

  if (compact) {
    return (
      <nav className="flex flex-wrap gap-1 border-b border-[var(--border-subtle)] pb-2">
        {MATH_NAV.flatMap((g) => g.items).map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-md px-2 py-1 text-caption font-medium",
              pathname === href || (href !== "/math" && pathname.startsWith(href))
                ? "bg-[var(--surface-muted)] text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <aside className="hidden w-44 shrink-0 lg:block">
      <nav className="sticky top-28 space-y-4">
        {MATH_NAV.map((group) => (
          <div key={group.group}>
            <p className="text-label mb-1.5">{group.group}</p>
            <ul className="space-y-0.5">
              {group.items.map(({ href, label }) => {
                const active =
                  pathname === href || (href !== "/math" && pathname.startsWith(href));
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn(
                        "block rounded-md px-2 py-1.5 text-body-sm transition-colors",
                        active
                          ? "bg-[var(--surface-muted)] font-medium text-[var(--text-primary)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]/60"
                      )}
                    >
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
