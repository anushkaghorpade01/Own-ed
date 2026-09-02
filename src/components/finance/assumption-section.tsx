"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Check } from "lucide-react";
import { CollapsibleSection } from "@/components/shared/metric-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  AssumptionsSearchProvider,
  normalizeSearchQuery,
  sectionMatchesSearch,
  textMatchesSearch,
  useAssumptionsFieldVisible,
} from "@/components/finance/assumptions-search";

type SaveStatus = "idle" | "saving" | "saved";

function parseNumber(
  raw: string,
  options?: { integer?: boolean; min?: number; max?: number }
): number {
  let n = parseFloat(raw);
  if (Number.isNaN(n)) n = 0;
  if (options?.integer) n = Math.round(n);
  if (options?.min != null) n = Math.max(options.min, n);
  if (options?.max != null) n = Math.min(options.max, n);
  return n;
}

function stableEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function SectionSaveButton({
  dirty,
  status,
  onClick,
}: {
  dirty: boolean;
  status: SaveStatus;
  onClick: () => void;
}) {
  const saved = status === "saved";
  const saving = status === "saving";

  return (
    <Button
      type="button"
      size="sm"
      onClick={onClick}
      disabled={saving || (!dirty && !saved)}
      className={cn(
        "min-w-[120px] font-semibold transition-all duration-200 active:scale-[0.98]",
        dirty &&
          !saving &&
          "bg-[#2C2825] text-white shadow-md ring-2 ring-[#C4A882]/40 hover:bg-[#1a1714]",
        saving && "bg-[#2C2825]/90 text-white shadow-inner ring-2 ring-[#C4A882]/30",
        saved &&
          "border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-300 hover:bg-emerald-50",
        !dirty && !saved && !saving && "opacity-60"
      )}
    >
      {saved ? (
        <span className="inline-flex items-center gap-1.5">
          <Check className="h-4 w-4" aria-hidden />
          Saved
        </span>
      ) : saving ? (
        "Saving…"
      ) : dirty ? (
        "Save changes"
      ) : (
        "Saved"
      )}
    </Button>
  );
}

type AssumptionSectionContextValue<T extends Record<string, unknown>> = {
  draft: T;
  patch: (partial: Partial<T>) => void;
  dirty: boolean;
  status: SaveStatus;
};

const AssumptionSectionContext =
  createContext<AssumptionSectionContextValue<Record<string, unknown>> | null>(null);

export function useSectionContext<T extends Record<string, unknown>>() {
  const ctx = useContext(AssumptionSectionContext);
  if (!ctx) throw new Error("Draft field must be used inside AssumptionSection");
  return ctx as AssumptionSectionContextValue<T>;
}

export function AssumptionSection<T extends Record<string, unknown>>({
  title,
  defaultOpen,
  committed,
  onSave,
  extraAction,
  searchKeywords = [],
  searchQuery = "",
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  committed: T;
  onSave: (draft: T) => void;
  extraAction?: ReactNode;
  searchKeywords?: string[];
  searchQuery?: string;
  children: ReactNode;
}) {
  const visible = sectionMatchesSearch(title, searchKeywords, searchQuery);
  const sectionWideMatch =
    !normalizeSearchQuery(searchQuery) || textMatchesSearch(title, searchQuery);
  const forceOpen = normalizeSearchQuery(searchQuery).length > 0;

  if (!visible) return null;
  const [draft, setDraft] = useState<T>(committed);
  const [status, setStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    setDraft((current) => {
      if (!stableEqual(current, committed)) return current;
      return committed;
    });
  }, [committed]);

  const dirty = useMemo(() => !stableEqual(draft, committed), [draft, committed]);

  const patch = useCallback((partial: Partial<T>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
    setStatus("idle");
  }, []);

  const handleSave = useCallback(() => {
    if (!dirty) return;
    setStatus("saving");
    window.requestAnimationFrame(() => {
      onSave(draft);
      setStatus("saved");
    });
  }, [dirty, draft, onSave]);

  useEffect(() => {
    if (status !== "saved") return;
    const t = window.setTimeout(() => setStatus("idle"), 2500);
    return () => window.clearTimeout(t);
  }, [status]);

  const ctx = useMemo(
    () => ({ draft, patch, dirty, status }),
    [draft, patch, dirty, status]
  );

  return (
    <CollapsibleSection
      title={title}
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      action={
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {extraAction}
          <SectionSaveButton dirty={dirty} status={status} onClick={handleSave} />
        </div>
      }
    >
      <AssumptionsSearchProvider query={searchQuery} sectionWideMatch={sectionWideMatch}>
        <AssumptionSectionContext.Provider
          value={ctx as AssumptionSectionContextValue<Record<string, unknown>>}
        >
          {children}
        {dirty && (
          <p className="mt-4 text-body-sm text-amber-900">
            You have unsaved changes in this section — click <strong>Save changes</strong> above.
          </p>
        )}
        {status === "saved" && (
          <p className="mt-4 text-body-sm font-medium text-emerald-800">
            Section saved — model totals have been updated.
          </p>
        )}
        </AssumptionSectionContext.Provider>
      </AssumptionsSearchProvider>
    </CollapsibleSection>
  );
}

export function DraftNumberField<K extends string>({
  field,
  label,
  suffix,
  help,
  inputClassName,
  integer,
  min,
  max,
}: {
  field: K;
  label: string;
  suffix?: string;
  help?: string;
  inputClassName?: string;
  integer?: boolean;
  min?: number;
  max?: number;
}) {
  const visible = useAssumptionsFieldVisible(label);
  if (!visible) return null;

  const { draft, patch } = useSectionContext<Record<K, number>>();
  const value = draft[field] ?? 0;

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-[#6B6560]">{label}</label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={String(value)}
          min={min}
          max={max}
          step={integer ? 1 : "any"}
          onChange={(e) =>
            patch({
              [field]: parseNumber(e.target.value, { integer, min, max }),
            } as Partial<Record<K, number>>)
          }
          className={cn("max-w-[200px]", inputClassName)}
        />
        {suffix && <span className="text-xs text-[#A39E98]">{suffix}</span>}
      </div>
      {help && <p className="text-[10px] text-[#A39E98]">{help}</p>}
    </div>
  );
}

export function DraftCheckboxField<K extends string>({
  field,
  label,
  id,
}: {
  field: K;
  label: string;
  id: string;
}) {
  const visible = useAssumptionsFieldVisible(label);
  if (!visible) return null;

  const { draft, patch } = useSectionContext<Record<K, boolean>>();
  const checked = Boolean(draft[field]);

  return (
    <div className="flex items-start gap-2 pt-1 sm:col-span-2">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) =>
          patch({ [field]: e.target.checked } as Partial<Record<K, boolean>>)
        }
        className="mt-0.5"
      />
      <label htmlFor={id} className="text-xs text-[#6B6560]">
        {label}
      </label>
    </div>
  );
}

export function DraftDateField<K extends string>({
  field,
  label,
}: {
  field: K;
  label: string;
}) {
  const visible = useAssumptionsFieldVisible(label);
  if (!visible) return null;

  const { draft, patch } = useSectionContext<Record<K, string>>();
  const raw = draft[field] ?? "";
  const value = typeof raw === "string" ? raw.slice(0, 10) : "";

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-[#6B6560]">{label}</label>
      <Input
        type="date"
        value={value}
        onChange={(e) =>
          patch({ [field]: e.target.value } as Partial<Record<K, string>>)
        }
        className="max-w-[200px]"
      />
    </div>
  );
}

export type CustomExpenseDraft = { id: string; name: string; amount: number };

export function DraftCustomExpenseRow<K extends string>({
  field,
  expenseId,
}: {
  field: K;
  expenseId: string;
}) {
  const { draft, patch } = useSectionContext<Record<K, CustomExpenseDraft[]>>();
  const items = (draft[field] ?? []) as CustomExpenseDraft[];
  const item = items.find((e) => e.id === expenseId);
  if (!item) return null;

  const update = (updates: Partial<CustomExpenseDraft>) => {
    patch({
      [field]: items.map((e) => (e.id === expenseId ? { ...e, ...updates } : e)),
    } as Partial<Record<K, CustomExpenseDraft[]>>);
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Input
          type="text"
          value={item.name}
          placeholder="Expense name"
          onChange={(e) => update({ name: e.target.value })}
          className="max-w-[180px]"
        />
      </div>
      <div className="space-y-1">
        <Input
          type="number"
          value={item.amount}
          onChange={(e) => update({ amount: parseNumber(e.target.value) })}
          className="max-w-[120px]"
        />
      </div>
      <span className="pb-2 text-xs text-[#A39E98]">₹/mo</span>
    </div>
  );
}

export type DepreciationAssetDraft = {
  id: string;
  name: string;
  purchaseValue: number;
  usefulLifeMonths: number;
  salvageValue: number;
};

export function DraftDepreciationAssetRow<K extends string>({
  field,
  assetId,
  monthlyDepreciationLabel,
}: {
  field: K;
  assetId: string;
  monthlyDepreciationLabel: ReactNode;
}) {
  const { draft, patch } = useSectionContext<Record<K, DepreciationAssetDraft[]>>();
  const assets = (draft[field] ?? []) as DepreciationAssetDraft[];
  const asset = assets.find((e) => e.id === assetId);
  if (!asset) return null;

  const update = (updates: Partial<DepreciationAssetDraft>) => {
    patch({
      [field]: assets.map((e) => (e.id === assetId ? { ...e, ...updates } : e)),
    } as Partial<Record<K, DepreciationAssetDraft[]>>);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <DraftNumberFieldInline
        label={`${asset.name} — purchase value`}
        value={asset.purchaseValue}
        onChange={(v) => update({ purchaseValue: v })}
        suffix="₹"
      />
      <DraftNumberFieldInline
        label="Useful life"
        value={asset.usefulLifeMonths}
        onChange={(v) => update({ usefulLifeMonths: Math.max(1, Math.round(v)) })}
        suffix="months"
        integer
      />
      <DraftNumberFieldInline
        label="Salvage value"
        value={asset.salvageValue}
        onChange={(v) => update({ salvageValue: v })}
        suffix="₹"
      />
      <div className="flex items-end pb-1 text-xs text-[#6B6560]">{monthlyDepreciationLabel}</div>
    </div>
  );
}

function DraftNumberFieldInline({
  label,
  value,
  onChange,
  suffix,
  integer,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  integer?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-[#6B6560]">{label}</label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={String(value)}
          step={integer ? 1 : "any"}
          onChange={(e) => onChange(parseNumber(e.target.value, { integer }))}
          className="max-w-[200px]"
        />
        {suffix && <span className="text-xs text-[#A39E98]">{suffix}</span>}
      </div>
    </div>
  );
}

export function DraftInlineNumber({
  value,
  onChange,
  className,
  integer,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  integer?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <Input
      type="number"
      value={String(value)}
      min={min}
      max={max}
      step={integer ? 1 : "any"}
      onChange={(e) => onChange(parseNumber(e.target.value, { integer, min, max }))}
      className={cn("h-8", className)}
    />
  );
}

export function DraftTextField({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <Input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    />
  );
}

/** Pick numeric assumption keys into a draft object */
export function pickNumericFields(
  source: Record<string, unknown>,
  keys: string[]
): Record<string, number> {
  return Object.fromEntries(keys.map((key) => [key, Number(source[key] ?? 0)]));
}
