import Decimal from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export const WEEKS_PER_MONTH = new Decimal(52).dividedBy(12);
export const MONTHS_PER_YEAR = new Decimal(12);

export function d(value: Decimal | number | string | null | undefined): Decimal {
  if (value instanceof Decimal) return value;
  if (value === null || value === undefined) return new Decimal(0);
  return new Decimal(value);
}

export function sum(values: Decimal[]): Decimal {
  return values.reduce((acc, v) => acc.plus(v), new Decimal(0));
}

export function avg(values: Decimal[]): Decimal {
  if (values.length === 0) return new Decimal(0);
  return sum(values).dividedBy(values.length);
}

/** Display rounding only — never use for intermediate calculations */
export function displayMoney(value: Decimal, decimals = 0): string {
  return value.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toString();
}

export function displayPercent(value: Decimal, decimals = 1): string {
  return value.times(100).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toString();
}

export interface CalculationStep {
  label: string;
  expression: string;
  result: Decimal;
}

export interface CalculationTrace {
  name: string;
  definition: string;
  unit: string;
  steps: CalculationStep[];
  result: Decimal;
}

export function trace(
  name: string,
  definition: string,
  unit: string,
  steps: CalculationStep[],
  result: Decimal
): CalculationTrace {
  return { name, definition, unit, steps, result };
}
