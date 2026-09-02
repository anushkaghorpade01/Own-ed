"use client";

import type { CalculationTrace } from "@/lib/finance/decimal";
import { formatINR } from "@/lib/format/currency";
import { ChevronDown, Info } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Explainer } from "@/components/ui/explainer";

interface MetricCardProps {
  label: string;
  value: string;
  subtitle?: string;
  definition?: string;
  whyItMatters?: string;
  businessInsight?: string;
  explainerSections?: Array<{ title: string; content: string }>;
  href?: string;
  trace?: CalculationTrace;
  className?: string;
}

export function MetricCard({
  label,
  value,
  subtitle,
  definition,
  whyItMatters,
  businessInsight,
  explainerSections,
  href,
  trace,
  className,
}: MetricCardProps) {
  const [showCalc, setShowCalc] = useState(false);
  const Wrapper = href ? "a" : "div";

  const sections =
    explainerSections ??
    (definition || whyItMatters
      ? [
          ...(definition ? [{ title: "What it means", content: definition }] : []),
          ...(whyItMatters ? [{ title: "Why it matters", content: whyItMatters }] : []),
        ]
      : undefined);

  return (
    <Wrapper
      href={href}
      className={cn(
        "card-surface group transition-colors hover:border-[var(--accent)]/40",
        href && "cursor-pointer block",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-label">{label}</p>
        {trace && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowCalc(!showCalc);
            }}
            className="rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            title="Show calculation"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <p className="text-kpi mt-1">{value}</p>
      {(subtitle || businessInsight) && (
        <p className="text-body-sm mt-1 text-[var(--text-secondary)]">
          {subtitle ?? businessInsight}
        </p>
      )}

      {sections && sections.length > 0 && (
        <Explainer trigger="What does this mean?" sections={sections} />
      )}

      {showCalc && trace && (
        <div className="mt-3 space-y-1 border-t border-[var(--border-subtle)] pt-2 text-body-sm text-[var(--text-secondary)] font-mono">
          {trace.steps.map((step, i) => (
            <p key={i}>
              {step.label}: {step.expression} = {formatTraceValue(step.result, trace.unit)}
            </p>
          ))}
        </div>
      )}
    </Wrapper>
  );
}

function formatTraceValue(value: { toString(): string }, unit: string): string {
  if (unit === "INR" || unit === "INR/month" || unit === "INR/seat" || unit === "INR/credit") {
    return formatINR(value.toString());
  }
  if (unit === "%") return `${value.toString()}%`;
  return `${value.toString()} ${unit}`;
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-[var(--space-desc-section)] flex items-end justify-between gap-4">
      <div>
        <h1 className="text-h1">{title}</h1>
        {description && (
          <p className="text-body mt-[var(--space-h1-desc)] max-w-2xl text-[var(--text-secondary)]">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function SampleStatusChip() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="rounded-full border border-[var(--border-default)] bg-[var(--surface-muted)] px-2 py-0.5 text-caption font-medium uppercase tracking-wide text-[var(--text-secondary)]"
        title="Sample model status"
      >
        Sample model
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 w-64 rounded-lg border border-[var(--border-default)] bg-white px-3 py-2 text-body-sm text-[var(--text-secondary)] shadow-sm">
          All numbers are sample / not actual — for planning only. Confirm tax and accounting
          treatment with your accountant.
        </div>
      )}
    </div>
  );
}

/** @deprecated Use SampleStatusChip */
export function SampleBanner() {
  return (
    <div className="mb-4">
      <SampleStatusChip />
    </div>
  );
}

export function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  action,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  action?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card-surface bg-[var(--surface-card)]/80">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex flex-1 items-center justify-between text-left"
        >
          <span className="text-h3">{title}</span>
          <ChevronDown className={cn("h-4 w-4 text-[var(--text-muted)] transition-transform", open && "rotate-180")} />
        </button>
        {action && <div className="ml-3">{action}</div>}
      </div>
      {open && <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">{children}</div>}
    </div>
  );
}

/** Compact insight — prefer MetricCard + Explainer for KPIs */
export function BusinessInsightCard({
  headline,
  explanation,
  action,
  isTheoretical,
}: {
  headline: string;
  explanation: string;
  action?: string;
  isTheoretical?: boolean;
}) {
  return (
    <div className={cn("card-surface", isTheoretical && "border-dashed")}>
      {isTheoretical && <p className="text-caption mb-1 uppercase">Theoretical — not a financial loss</p>}
      <p className="text-body font-medium text-[var(--text-primary)]">{headline}</p>
      <Explainer
        trigger="Explain"
        sections={[{ title: "Detail", content: explanation + (action ? ` ${action}` : "") }]}
      />
    </div>
  );
}
