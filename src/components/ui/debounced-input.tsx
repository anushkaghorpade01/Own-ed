"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input, type InputProps } from "@/components/ui/input";

type DebouncedTextInputProps = Omit<InputProps, "value" | "onChange" | "type"> & {
  value: string | number;
  onCommit: (value: string) => void;
  debounceMs?: number;
};

type DebouncedNumberInputProps = Omit<InputProps, "value" | "onChange" | "type"> & {
  value: string | number;
  onCommit: (value: number) => void;
  debounceMs?: number;
};

function useDebouncedCommit(
  externalValue: string | number,
  onCommit: (value: string) => void,
  debounceMs: number
) {
  const [local, setLocal] = useState(String(externalValue));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  useEffect(() => {
    setLocal(String(externalValue));
  }, [externalValue]);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onCommitRef.current(local);
  }, [local]);

  const schedule = useCallback(
    (next: string) => {
      setLocal(next);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        onCommitRef.current(next);
      }, debounceMs);
    },
    [debounceMs]
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  return { local, schedule, flush };
}

/** Number input with local draft state — commits to store after debounce or on blur. */
export function DebouncedNumberInput({
  value,
  onCommit,
  debounceMs = 350,
  onBlur,
  ...props
}: DebouncedNumberInputProps) {
  const commitString = useCallback(
    (raw: string) => onCommit(parseFloat(raw) || 0),
    [onCommit]
  );
  const { local, schedule, flush } = useDebouncedCommit(value, commitString, debounceMs);

  return (
    <Input
      {...props}
      type="number"
      value={local}
      onChange={(e) => schedule(e.target.value)}
      onBlur={(e) => {
        flush();
        onBlur?.(e);
      }}
    />
  );
}

/** Text input with local draft state — commits after debounce or on blur. */
export function DebouncedTextInput({
  value,
  onCommit,
  debounceMs = 350,
  onBlur,
  ...props
}: DebouncedTextInputProps) {
  const { local, schedule, flush } = useDebouncedCommit(value, onCommit, debounceMs);

  return (
    <Input
      {...props}
      type="text"
      value={local}
      onChange={(e) => schedule(e.target.value)}
      onBlur={(e) => {
        flush();
        onBlur?.(e);
      }}
    />
  );
}
