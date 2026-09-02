"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

function useSavedFlash() {
  const [saved, setSaved] = useState(false);
  const flash = useCallback(() => {
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 1500);
    return () => clearTimeout(t);
  }, []);
  return { saved, flash };
}

export function SaveableInlineNumber({
  value,
  onSave,
  className,
  integer = false,
  min,
  max,
}: {
  value: number;
  onSave: (value: number) => void;
  className?: string;
  integer?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <SaveableAssumptionField
      label=""
      value={value}
      onSave={onSave}
      inputClassName={className}
      integer={integer}
      min={min}
      max={max}
    />
  );
}

export function SaveableAssumptionField({
  label,
  value,
  onSave,
  suffix,
  help,
  inputClassName,
  integer = false,
  min,
  max,
}: {
  label: string;
  value: number;
  onSave: (value: number) => void;
  suffix?: string;
  help?: string;
  inputClassName?: string;
  integer?: boolean;
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  const { saved, flash } = useSavedFlash();
  const dirty = draft !== String(value);

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const parse = (raw: string) => {
    let n = parseFloat(raw);
    if (Number.isNaN(n)) n = 0;
    if (integer) n = Math.round(n);
    if (min != null) n = Math.max(min, n);
    if (max != null) n = Math.min(max, n);
    return n;
  };

  const handleSave = () => {
    const parsed = parse(draft);
    setDraft(String(parsed));
    onSave(parsed);
    flash();
  };

  return (
    <div className={cn("space-y-1", !label && !help && "space-y-0")}>
      {label ? (
        <label className="text-xs font-medium text-[#6B6560]">{label}</label>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="number"
          value={draft}
          min={min}
          max={max}
          step={integer ? 1 : "any"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSave();
            }
          }}
          className={cn("max-w-[200px]", inputClassName)}
        />
        {suffix && <span className="text-xs text-[#A39E98]">{suffix}</span>}
        <Button
          type="button"
          size="sm"
          variant={dirty ? "default" : "outline"}
          onClick={handleSave}
          disabled={!dirty && !saved}
          className="h-8"
        >
          {saved ? "Saved" : "Save"}
        </Button>
      </div>
      {help ? <p className="text-[10px] text-[#A39E98]">{help}</p> : null}
    </div>
  );
}

export function SaveableTextAssumptionField({
  label,
  value,
  onSave,
  placeholder,
  inputClassName,
}: {
  label?: string;
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  inputClassName?: string;
}) {
  const [draft, setDraft] = useState(value);
  const { saved, flash } = useSavedFlash();
  const dirty = draft !== value;

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const handleSave = () => {
    onSave(draft);
    flash();
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-[#6B6560]">{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="text"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSave();
            }
          }}
          className={cn("max-w-[200px]", inputClassName)}
        />
        <Button
          type="button"
          size="sm"
          variant={dirty ? "default" : "outline"}
          onClick={handleSave}
          disabled={!dirty && !saved}
          className="h-8"
        >
          {saved ? "Saved" : "Save"}
        </Button>
      </div>
    </div>
  );
}

export function SaveableCheckboxAssumptionField({
  label,
  checked,
  onSave,
  id,
}: {
  label: string;
  checked: boolean;
  onSave: (checked: boolean) => void;
  id: string;
}) {
  const [draft, setDraft] = useState(checked);
  const { saved, flash } = useSavedFlash();
  const dirty = draft !== checked;

  useEffect(() => {
    setDraft(checked);
  }, [checked]);

  const handleSave = () => {
    onSave(draft);
    flash();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <input
        type="checkbox"
        id={id}
        checked={draft}
        onChange={(e) => setDraft(e.target.checked)}
      />
      <label htmlFor={id} className="text-xs text-[#6B6560]">
        {label}
      </label>
      <Button
        type="button"
        size="sm"
        variant={dirty ? "default" : "outline"}
        onClick={handleSave}
        disabled={!dirty && !saved}
        className="h-8"
      >
        {saved ? "Saved" : "Save"}
      </Button>
    </div>
  );
}

export function SaveableDateAssumptionField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (value: string) => void;
}) {
  const normalized = value?.slice(0, 10) ?? "";
  const [draft, setDraft] = useState(normalized);
  const { saved, flash } = useSavedFlash();
  const dirty = draft !== normalized;

  useEffect(() => {
    setDraft(normalized);
  }, [normalized]);

  const handleSave = () => {
    onSave(draft);
    flash();
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-[#6B6560]">{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="date"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="max-w-[200px]"
        />
        <Button
          type="button"
          size="sm"
          variant={dirty ? "default" : "outline"}
          onClick={handleSave}
          disabled={!dirty && !saved}
          className="h-8"
        >
          {saved ? "Saved" : "Save"}
        </Button>
      </div>
    </div>
  );
}
