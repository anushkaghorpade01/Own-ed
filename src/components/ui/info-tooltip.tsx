"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import { Info } from "lucide-react";
import { cn } from "@/lib/cn";

export interface InfoTooltipProps {
  content: string;
  className?: string;
  /** Wider panel for longer explanations */
  wide?: boolean;
  /** Screen-reader label for the trigger button */
  label?: string;
}

export function InfoTooltip({
  content,
  className,
  wide = false,
  label = "More information",
}: InfoTooltipProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-default)]",
            className
          )}
          aria-label={label}
        >
          <Info className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          align="center"
          sideOffset={6}
          className={cn(
            "z-50 rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-left text-body-sm leading-snug text-[var(--text-secondary)] shadow-md whitespace-pre-line",
            wide ? "max-w-[22rem]" : "max-w-[20rem]"
          )}
        >
          {content}
          <Tooltip.Arrow className="fill-[var(--surface-card)]" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function MetricLabel({
  label,
  tooltip,
  tooltipLabel,
  wide,
  className,
}: {
  label: string;
  tooltip: string;
  tooltipLabel?: string;
  wide?: boolean;
  className?: string;
}) {
  return (
    <p className={cn("text-label inline-flex items-center gap-1.5", className)}>
      <span>{label}</span>
      <InfoTooltip content={tooltip} label={tooltipLabel ?? `About ${label}`} wide={wide} />
    </p>
  );
}

export function TableHeaderWithTooltip({
  label,
  tooltip,
  align = "left",
}: {
  label: string;
  tooltip: string;
  align?: "left" | "right";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        align === "right" && "justify-end"
      )}
    >
      <span>{label}</span>
      <InfoTooltip content={tooltip} label={`About ${label}`} />
    </span>
  );
}
