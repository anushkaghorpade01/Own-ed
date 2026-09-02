"use client";

import type { CalculationTrace } from "@/lib/finance/decimal";
import { formatINR } from "@/lib/format/currency";
import { Calculator, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Explainer } from "@/components/ui/explainer";
import { InfoTooltip } from "@/components/ui/info-tooltip";

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
  /** Short tooltip beside title — use for simple definitions */
  tooltip?: string;
  className?: string;
  size?: "default" | "compact";
}

function MetricCardTitle({
  label,
  tooltip,
  trace,
  onToggleCalc,
  showCalc,
}: {
  label: string;
  tooltip?: string;
  trace?: CalculationTrace;
  onToggleCalc?: () => void;
  showCalc?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <p className="text-card-title">{label}</p>
      {tooltip && <InfoTooltip content={tooltip} label={`About ${label}`} />}
      {trace && onToggleCalc && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleCalc();
          }}
          className={cn(
            "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-default)]",
            showCalc && "text-[var(--text-secondary)]"
          )}
          aria-label={`Show calculation for ${label}`}
          title="Show calculation"
        >
          <Calculator className="h-3 w-3" strokeWidth={2} />
        </button>
      )}
    </div>
  );
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
  tooltip,
  className,
  size = "default",
}: MetricCardProps) {
  const [showCalc, setShowCalc] = useState(false);
  const Wrapper = href ? "a" : "div";
  const isCompact = size === "compact";

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
        isCompact ? "card-surface-compact" : "card-surface",
        "flex h-full flex-col items-start transition-colors hover:border-[var(--accent)]/40",
        href && "block cursor-pointer",
        className
      )}
    >
      <MetricCardTitle
        label={label}
        tooltip={tooltip}
        trace={trace}
        showCalc={showCalc}
        onToggleCalc={() => setShowCalc(!showCalc)}
      />
      <p className="text-metric-value mt-[var(--space-card-title-value)]">{value}</p>
      {(subtitle || businessInsight) && (
        <p className="text-body-sm mt-[var(--space-value-desc)] text-[var(--text-secondary)] leading-snug">
          {subtitle ?? businessInsight}
        </p>
      )}

      {sections && sections.length > 0 && (
        <Explainer trigger="What does this mean?" sections={sections} className="mt-[var(--space-2)]" />
      )}

      {showCalc && trace && (
        <div className="mt-[var(--space-3)] w-full space-y-1 border-t border-[var(--border-subtle)] pt-[var(--space-2)] font-mono text-body-sm text-[var(--text-secondary)]">
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
    <div className="mb-[var(--space-desc-section)] flex items-end justify-between gap-[var(--space-4)]">
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
  forceOpen = false,
  action,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  action?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = forceOpen || open;
  return (
    <div className="card-surface">
      <div className="flex items-center justify-between gap-[var(--space-3)]">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex flex-1 items-center justify-between text-left"
        >
          <span className="text-h3">{title}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </button>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {isOpen && (
        <div className="mt-[var(--space-3)] border-t border-[var(--border-subtle)] pt-[var(--space-3)]">
          {children}
        </div>
      )}
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
      {isTheoretical && (
        <p className="text-caption mb-1 uppercase">Theoretical — not a financial loss</p>
      )}
      <p className="text-body font-medium text-[var(--text-primary)]">{headline}</p>
      <Explainer
        trigger="Explain"
        sections={[{ title: "Detail", content: explanation + (action ? ` ${action}` : "") }]}
        className="mt-[var(--space-2)]"
      />
    </div>
  );
}

export { MetricGrid, PageSection, SectionCard, SectionCardHeader } from "@/components/shared/panels";
