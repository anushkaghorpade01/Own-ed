"use client";

import Link from "next/link";
import { MetricLabel } from "@/components/ui/info-tooltip";
import {
  SERVICE_DEMAND_MIX_TOOLTIP,
  THREE_STEP,
  SALES_PLAN_GUIDE_HREF,
} from "@/lib/finance/sales-plan-copy";

export function SalesPlanThreeStepExplainer() {
  const steps = [
    { key: "serviceMix", href: "/math/access-products/mix" },
    { key: "salesPlan" as const },
    { key: "capacity" as const },
  ] as const;

  return (
    <div className="mb-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)]/40 px-4 py-3">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        {steps.map((step, i) => {
          const meta = THREE_STEP[step.key === "serviceMix" ? "serviceMix" : step.key];
          const content = (
            <div className="min-w-[140px]">
              <MetricLabel
                label={`${i + 1}. ${meta.label}`}
                tooltip={meta.tooltip}
                tooltipLabel={meta.subtitle}
                className="text-body-sm font-semibold text-[var(--text-primary)]"
              />
              <p className="text-caption mt-0.5 text-[var(--text-muted)]">{meta.subtitle}</p>
            </div>
          );
          if ("href" in step && step.href) {
            return (
              <Link key={step.key} href={step.href} className="hover:opacity-80">
                {content}
              </Link>
            );
          }
          return <div key={step.key}>{content}</div>;
        })}
      </div>
      <p className="text-caption mt-2 text-[var(--text-muted)]">
        <Link href={SALES_PLAN_GUIDE_HREF} className="underline hover:text-[var(--text-primary)]">
          Service demand mix vs sales plan vs capacity →
        </Link>
      </p>
    </div>
  );
}

export function ServiceDemandMixReference({
  products,
  mixPct,
}: {
  products: Array<{ id: string; name: string }>;
  mixPct: Record<string, number>;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border-subtle)] bg-white/50 px-3 py-2">
      <MetricLabel
        label="Service demand mix (forecast)"
        tooltip={SERVICE_DEMAND_MIX_TOOLTIP}
        tooltipLabel="Service demand mix"
        className="text-body-sm font-medium"
      />
      <p className="text-caption mt-1 text-[var(--text-muted)]">
        Booking share OWNED uses for the forecast — edit on{" "}
        <Link href="/math/access-products/mix" className="underline">
          Access Products → Mix
        </Link>
        .
      </p>
      <ul className="text-caption mt-2 space-y-0.5 text-[var(--text-secondary)]">
        {products.map((p) => (
          <li key={p.id}>
            {p.name}: {mixPct[p.id]?.toFixed(0) ?? 0}% of occupied bookings
          </li>
        ))}
      </ul>
    </div>
  );
}
