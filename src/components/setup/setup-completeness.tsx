"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/lib/store/app-store";
import { CAPEX_FIELDS, FINANCING_FIELDS } from "@/lib/finance/assumption-fields";
import { cn } from "@/lib/cn";
import { SectionCard } from "@/components/shared/panels";
import { Button } from "@/components/ui/button";

type Status = "confirmed" | "sample" | "missing";

const SETUP_FIELDS: Array<{ key: string; label: string; status: Status }> = [
  { key: "rent", label: "Rent", status: "sample" },
  { key: "capexReformers", label: "Reformer purchase", status: "sample" },
  { key: "capexInteriorFitout", label: "Fit-out", status: "missing" },
  { key: "securityDepositAmount", label: "Security deposit", status: "missing" },
  { key: "workingCapital", label: "Working capital", status: "missing" },
  { key: "ownerInstructorSalary", label: "Founder salary", status: "sample" },
];

function fieldStatus(
  assumptions: Record<string, unknown>,
  key: string,
  defaultStatus: Status
): Status {
  const val = assumptions[key];
  if (val === undefined || val === null || val === 0)
    return defaultStatus === "confirmed" ? "missing" : defaultStatus;
  return "confirmed";
}

const statusStyles: Record<Status, string> = {
  confirmed: "text-emerald-700 bg-emerald-50",
  sample: "text-amber-800 bg-amber-50",
  missing: "text-red-700 bg-red-50",
};

export function SetupCompleteness({
  defaultOpen = false,
  showCompleteLink = false,
}: {
  defaultOpen?: boolean;
  showCompleteLink?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { state } = useApp();
  const a = state.assumptions as Record<string, unknown>;

  const items = [
    ...SETUP_FIELDS.map((f) => ({
      label: f.label,
      status: fieldStatus(a, f.key, f.status),
    })),
    ...CAPEX_FIELDS.slice(0, 4).map((f) => ({
      label: f.label,
      status: fieldStatus(a, f.key, "missing"),
    })),
  ];

  const incomplete = items.filter((i) => i.status !== "confirmed").length;
  const statusLine =
    incomplete === 0
      ? "All key setup assumptions confirmed."
      : `${incomplete} materially important assumption${incomplete === 1 ? "" : "s"} still sample or missing.`;

  return (
    <SectionCard compact>
      <div className="flex items-start justify-between gap-[var(--space-3)]">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex min-w-0 flex-1 items-start justify-between gap-[var(--space-3)] text-left"
          aria-expanded={open}
        >
          <div className="min-w-0">
            <p className="text-h3">Setup model completeness</p>
            <p className="text-body-sm mt-[var(--space-1)] text-[var(--text-secondary)]">{statusLine}</p>
          </div>
          <ChevronDown
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
        {showCompleteLink && (
          <Button asChild size="sm" className="shrink-0">
            <Link href="/math/assumptions">Complete setup</Link>
          </Button>
        )}
      </div>

      {open && (
        <div className="mt-[var(--space-3)] border-t border-[var(--border-subtle)] pt-[var(--space-3)]">
          <ul className="grid gap-[var(--space-2)] sm:grid-cols-2">
            {items.map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-between gap-[var(--space-2)] text-body-sm"
              >
                <span className="text-[var(--text-primary)]">{item.label}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-caption font-medium uppercase",
                    statusStyles[item.status]
                  )}
                >
                  {item.status}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-caption mt-[var(--space-3)]">
            Also review: {FINANCING_FIELDS.map((f) => f.label).slice(0, 3).join(", ")}… under
            Assumptions.
          </p>
        </div>
      )}
    </SectionCard>
  );
}
