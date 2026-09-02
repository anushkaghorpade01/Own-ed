import type Decimal from "decimal.js";

export function exportNum(value: Decimal | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value;
  }
  const n = value.toNumber();
  return Number.isFinite(n) ? n : null;
}

export function exportPct(value: Decimal | number | null | undefined): number | null {
  const n = exportNum(value);
  if (n == null) return null;
  return n / 100;
}

/** Display percentage stored as whole number (e.g. 75 → 0.75 for Excel). */
export function exportWholePct(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value / 100;
}

export function safeStr(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number" && !Number.isFinite(value)) return "";
  return String(value);
}
