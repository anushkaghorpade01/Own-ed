"use client";

import Link from "next/link";
import { useApp } from "@/lib/store/app-store";
import { CAPEX_FIELDS, FINANCING_FIELDS } from "@/lib/finance/assumption-fields";
import { cn } from "@/lib/cn";

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
  if (val === undefined || val === null || val === 0) return defaultStatus === "confirmed" ? "missing" : defaultStatus;
  return "confirmed";
}

const statusStyles: Record<Status, string> = {
  confirmed: "text-emerald-700 bg-emerald-50",
  sample: "text-amber-800 bg-amber-50",
  missing: "text-red-700 bg-red-50",
};

export function SetupCompleteness() {
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

  return (
    <section className="card-surface">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-h2">Setup model completeness</h2>
          <p className="text-body-sm mt-1 text-[var(--text-secondary)]">
            {incomplete} materially important assumption{incomplete === 1 ? "" : "s"} still sample or missing.
          </p>
        </div>
        <Link
          href="/math/assumptions"
          className="shrink-0 rounded-md bg-[var(--text-primary)] px-3 py-1.5 text-body-sm font-medium text-white hover:opacity-90"
        >
          Complete setup assumptions
        </Link>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-2 text-body-sm">
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
      <p className="text-caption mt-3">
        Also review: {FINANCING_FIELDS.map((f) => f.label).slice(0, 3).join(", ")}… under Assumptions.
      </p>
    </section>
  );
}
