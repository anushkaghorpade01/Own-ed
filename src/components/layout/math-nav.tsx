"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

const MATH_NAV = [
  {
    group: "Plan",
    items: [
      { href: "/math", label: "Overview" },
      { href: "/math/workbench", label: "Scenario settings" },
      { href: "/math/assumptions", label: "Assumptions" },
      { href: "/math/scenarios", label: "Scenario Analysis" },
      { href: "/math/sales-target", label: "Sales & Client Target" },
      { href: "/math/optimise", label: "Optimise" },
      { href: "/math/calculators", label: "Calculators" },
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
      { href: "/math/funnel", label: "Sales funnel" },
      { href: "/math/actuals", label: "Actuals" },
      { href: "/math/snapshots", label: "Snapshots" },
    ],
  },
];

export function MathNav({ compact }: { compact?: boolean }) {
  const pathname = usePathname();const router=useRouter();

  if (compact) {
    const items=MATH_NAV.flatMap(g=>g.items);const selected=items.find(i=>i.href===pathname)?.href??items.find(i=>i.href!=='/math'&&pathname.startsWith(i.href))?.href??'/math';
    return <label className="flex items-center justify-between gap-3 border-b border-[#E8E2D9] pb-3 text-xs text-[#6B6560]">Math workspace<select aria-label="Math workspace page" value={selected} onChange={e=>router.push(e.target.value)} className="max-w-[65%] rounded-lg border border-[#E0DAD2] bg-white px-3 py-2 text-[#2C2825]">{MATH_NAV.map(g=><optgroup key={g.group} label={g.group}>{g.items.map(i=><option key={i.href} value={i.href}>{i.label}</option>)}</optgroup>)}</select></label>;
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
