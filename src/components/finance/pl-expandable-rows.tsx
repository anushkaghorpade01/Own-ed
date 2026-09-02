"use client";

import {
  Children,
  useState,
  type ReactNode,
} from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/format/currency";
import type { PLBreakdownLine } from "@/lib/finance/pl-breakdown";
import Decimal from "decimal.js";
import type { YearlyPLRow } from "@/lib/finance/engine/yearly-pl";
import type { YearProfitExplanation } from "@/lib/finance/engine/yearly-profit-drivers";
import { formatPercent } from "@/lib/format/currency";
import { InfoTooltip } from "@/components/ui/info-tooltip";

function formatPLValue(value: Decimal, negative?: boolean): string {
  if (negative) return `(${formatINR(value.abs())})`;
  if (value.isNegative()) return `(${formatINR(value.abs())})`;
  return formatINR(value);
}

export function ExpandablePLRow({
  label,
  value,
  bold,
  indent,
  children,
  breakdown,
  defaultOpen,
}: {
  label: ReactNode;
  value: string;
  bold?: boolean;
  indent?: boolean;
  children?: ReactNode;
  breakdown?: PLBreakdownLine[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const expandable = Boolean(
    (breakdown && breakdown.length > 0) || (children && !breakdown)
  );

  const toggle = () => {
    if (expandable) setOpen((prev) => !prev);
  };

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={!expandable}
        className={cn(
          "flex w-full justify-between py-1.5 text-left transition-colors",
          indent ? "pl-4" : "",
          bold ? "border-t border-[#E8E2D9] pt-2 font-medium" : "",
          expandable && "cursor-pointer hover:bg-[#FAF8F5]/80 rounded-sm -mx-1 px-1",
          !expandable && "cursor-default"
        )}
      >
        <span
          className={cn(
            "inline-flex items-center gap-1.5",
            bold ? "text-[#2C2825]" : "text-[#6B6560]"
          )}
        >
          {expandable && (
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-[#A39E98] transition-transform",
                open && "rotate-90"
              )}
              aria-hidden
            />
          )}
          {label}
        </span>
        <span className={bold ? "text-[#2C2825]" : "text-[#6B6560]"}>{value}</span>
      </button>
      {open && expandable && (
        <div className="mb-1 space-y-0.5 border-l border-[#E8E2D9] pl-6 ml-2">
          {breakdown
            ? breakdown.map((line) => (
                <div key={line.label} className="flex justify-between py-1 text-[#6B6560]">
                  <span className="text-xs">{line.label}</span>
                  <span className="text-xs">{formatPLValue(line.value, line.value.isNegative())}</span>
                </div>
              ))
            : children}
        </div>
      )}
    </div>
  );
}

function YearlyCell({ value, yoy }: { value: string; yoy?: string | null }) {
  return (
    <div className="text-right">
      <div>{value}</div>
      {yoy && <div className="text-[10px] text-[#A39E98]">{yoy}</div>}
    </div>
  );
}

function YearlyNetProfitCell({
  value,
  yoy,
  explanation,
}: {
  value: string;
  yoy?: string | null;
  explanation?: YearProfitExplanation;
}) {
  return (
    <div className="flex items-start justify-end gap-1">
      <div className="text-right">
        <div>{value}</div>
        {yoy && <div className="text-[10px] text-[#A39E98]">{yoy}</div>}
      </div>
      {explanation && explanation.direction !== "baseline" && (
        <InfoTooltip
          content={explanation.detail}
          label={`Why Year ${explanation.year} net profit changed`}
          className="mt-0.5"
        />
      )}
    </div>
  );
}

function YearlyDetailRow({
  label,
  years,
  pick,
  negative,
}: {
  label: string;
  years: YearlyPLRow[];
  pick: (y: YearlyPLRow) => Decimal;
  negative?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_repeat(var(--year-cols),minmax(0,1fr))] gap-2 py-1 pl-6">
      <span className="text-xs text-[#6B6560]">{label}</span>
      {years.map((y) => (
        <YearlyCell key={y.year} value={formatPLValue(pick(y), negative)} />
      ))}
    </div>
  );
}

export function ExpandableYearlyGroup({
  label,
  years,
  pick,
  pickYoy,
  bold,
  indent,
  negative,
  explanations,
  showProfitTooltip,
  children,
  defaultOpen,
}: {
  label: string;
  years: YearlyPLRow[];
  pick: (y: YearlyPLRow) => Decimal;
  pickYoy?: (y: YearlyPLRow) => Decimal | null;
  bold?: boolean;
  indent?: boolean;
  negative?: boolean;
  explanations?: YearProfitExplanation[];
  showProfitTooltip?: boolean;
  children?: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const hasChildren = Children.count(children) > 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => hasChildren && setOpen((prev) => !prev)}
        disabled={!hasChildren}
        className={cn(
          "grid w-full grid-cols-[1fr_repeat(var(--year-cols),minmax(0,1fr))] gap-2 py-1.5 text-left transition-colors rounded-sm",
          hasChildren && "hover:bg-[#FAF8F5]/80",
          indent ? "pl-4" : "",
          bold ? "border-t border-[#E8E2D9] pt-2 font-medium" : "",
          !hasChildren && "cursor-default"
        )}
      >
        <span
          className={cn(
            "inline-flex items-center gap-1.5",
            bold ? "text-[#2C2825]" : "text-[#6B6560]"
          )}
        >
          {hasChildren && (
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-[#A39E98] transition-transform",
                open && "rotate-90"
              )}
              aria-hidden
            />
          )}
          {label}
        </span>
        {years.map((y) => {
          const val = pick(y);
          const formatted = formatPLValue(val, negative);
          const yoy = pickYoy?.(y);
          const yoyLabel =
            yoy !== undefined && yoy !== null
              ? `${yoy.gte(0) ? "+" : ""}${formatPercent(yoy)} YoY`
              : undefined;

          if (showProfitTooltip && explanations) {
            const explanation = explanations.find((e) => e.year === y.year);
            return (
              <YearlyNetProfitCell
                key={y.year}
                value={formatted}
                yoy={yoyLabel}
                explanation={explanation}
              />
            );
          }

          return <YearlyCell key={y.year} value={formatted} yoy={yoyLabel} />;
        })}
      </button>
      {open && hasChildren && (
        <div className="space-y-0.5 border-l border-[#E8E2D9] ml-4 mb-1">{children}</div>
      )}
    </div>
  );
}

export { YearlyDetailRow };
