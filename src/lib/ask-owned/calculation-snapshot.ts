export type CalculationSnapshotKind =
  | "class_count"
  | "capacity_spots"
  | "class_sessions"
  | "revenue"
  | "profit"
  | "contribution"
  | "break_even"
  | "clients"
  | "funding"
  | "metric";

export type ValueBasis = "monthly" | "weekly" | "daily" | "annual" | "absolute" | "per_unit";

export interface CalculationSnapshot {
  kind: CalculationSnapshotKind;
  label: string;
  primaryValue: number;
  primaryUnit: string;
  basis: ValueBasis;
  occupancyPct?: number;
  classSize?: number;
  extras?: Record<string, number>;
}
