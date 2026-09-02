"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { InfoTooltip } from "@/components/ui/info-tooltip";

export function PageSection({
  children,
  className,
  spacing = "default",
}: {
  children: ReactNode;
  className?: string;
  spacing?: "default" | "major" | "none";
}) {
  return (
    <section
      className={cn(
        spacing === "major" && "page-section-major",
        spacing === "default" && "page-section",
        className
      )}
    >
      {children}
    </section>
  );
}

export function MetricGrid({
  children,
  className,
  columns = 4,
}: {
  children: ReactNode;
  className?: string;
  /** Max columns at desktop: 2, 3, or 4 */
  columns?: 2 | 3 | 4;
}) {
  return (
    <div
      className={cn(
        columns === 2 && "metric-grid-cols-2",
        columns === 3 && "metric-grid-cols-3",
        columns === 4 && "metric-grid",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SectionCard({
  children,
  className,
  compact = false,
}: {
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <section className={cn(compact ? "section-card" : "card-surface", className)}>
      {children}
    </section>
  );
}

export function SectionCardHeader({
  title,
  description,
  action,
  tooltip,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  tooltip?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-[var(--space-4)]">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <h2 className="text-h2">{title}</h2>
          {tooltip && <InfoTooltip content={tooltip} label={`About ${title}`} />}
        </div>
        {description && (
          <p className="text-body-sm mt-[var(--space-1)] text-[var(--text-secondary)]">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
