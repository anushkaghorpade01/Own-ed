/**
 * Investment recovery position — labels and formatting.
 *
 * recoveryPosition = cumulativeOperatingCashGenerated − paybackInvestmentBase
 * Negative → investment still to recover
 * Zero → fully recovered
 * Positive → net cash above initial investment
 */
import type Decimal from "decimal.js";

export interface RecoveryPositionDisplay {
  label: string;
  amountLabel: string;
  amount: Decimal;
  isRecovered: boolean;
  isAboveInvestment: boolean;
}

export function recoveryPositionFromParts(
  cumulativeOperatingCashGenerated: Decimal,
  paybackInvestmentBase: Decimal
): Decimal {
  return cumulativeOperatingCashGenerated.minus(paybackInvestmentBase);
}

export function formatRecoveryPosition(position: Decimal): RecoveryPositionDisplay {
  if (position.isZero()) {
    return {
      label: "Initial investment fully recovered",
      amountLabel: "Initial investment fully recovered",
      amount: position,
      isRecovered: true,
      isAboveInvestment: false,
    };
  }
  if (position.lt(0)) {
    return {
      label: "Investment still to recover",
      amountLabel: "Investment still to recover",
      amount: position.abs(),
      isRecovered: false,
      isAboveInvestment: false,
    };
  }
  return {
    label: "Net cash above initial investment",
    amountLabel: "Net cash above initial investment",
    amount: position,
    isRecovered: true,
    isAboveInvestment: true,
  };
}

export function formatRecoveryPositionShort(position: Decimal): string {
  const display = formatRecoveryPosition(position);
  return display.label;
}

/** Chart/tooltip helper when value is already a plain number */
export function formatRecoveryPositionFromNumber(position: number): {
  label: string;
  amount: number;
} {
  if (position === 0) {
    return { label: "Initial investment fully recovered", amount: 0 };
  }
  if (position < 0) {
    return { label: "Investment still to recover", amount: Math.abs(position) };
  }
  return { label: "Net cash above initial investment", amount: position };
}
