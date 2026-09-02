import Decimal from "decimal.js";

/** Indian locale number formatting (e.g. ₹12,50,000) */
export function formatINR(
  value: Decimal | number | string,
  options?: { showSymbol?: boolean; decimals?: number }
): string {
  const { showSymbol = true, decimals = 0 } = options ?? {};
  const d = value instanceof Decimal ? value : new Decimal(value);
  const rounded = d.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
  const [intPart, decPart] = rounded.abs().toFixed(decimals).split(".");
  const lastThree = intPart.slice(-3);
  const other = intPart.slice(0, -3);
  const formatted =
    other.replace(/\B(?=(\d{2})+(?!\d))/g, ",") +
    (other ? "," : "") +
    lastThree;
  const sign = rounded.isNegative() ? "−" : "";
  const symbol = showSymbol ? "₹" : "";
  const decimalSuffix = decimals > 0 ? `.${decPart}` : "";
  return `${sign}${symbol}${formatted}${decimalSuffix}`;
}

export function formatPercent(
  value: Decimal | number | string,
  decimals = 1
): string {
  const num = value instanceof Decimal ? value : new Decimal(value);
  return `${num.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toString()}%`;
}

/** For fractional values 0–1 (e.g. 0.6 → 60%) */
export function formatPercentFromFraction(
  value: Decimal | number | string,
  decimals = 1
): string {
  const num = value instanceof Decimal ? value : new Decimal(value);
  return `${num.times(100).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toString()}%`;
}

export function formatNumber(
  value: Decimal | number | string,
  decimals = 0
): string {
  const d = value instanceof Decimal ? value : new Decimal(value);
  return d.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toString();
}
