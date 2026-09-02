import { d, trace, WEEKS_PER_MONTH, type CalculationTrace } from "../decimal";
import type { FinanceAssumptions } from "../schemas";
import Decimal from "decimal.js";

/** Direct variable cost per attended group-class seat */
export function variableCostPerAttendedSeat(
  assumptions: FinanceAssumptions
): Decimal {
  return d(assumptions.sessionConsumables)
    .plus(d(assumptions.instructorPerAttendeePayout))
    .plus(
      d(assumptions.instructorPerClassPayout).dividedBy(
        assumptions.maxGroupClassSize
      )
    );
}

export function paymentFeeOnNet(
  assumptions: FinanceAssumptions,
  netAmount: Decimal
): Decimal {
  return netAmount.times(d(assumptions.paymentGatewayPct).dividedBy(100));
}

/** Contribution per delivered session after direct variable costs and payment fees */
export function contributionPerSession(
  assumptions: FinanceAssumptions,
  netRevenuePerSession: Decimal
): Decimal {
  return netRevenuePerSession
    .minus(variableCostPerAttendedSeat(assumptions))
    .minus(paymentFeeOnNet(assumptions, netRevenuePerSession));
}

/** Expected contribution when seat may not fill — not actual lost revenue */
export function expectedFlexibleContribution(
  contributionWhenOccupied: Decimal,
  fillProbabilityPct: number
): Decimal {
  return contributionWhenOccupied.times(
    d(fillProbabilityPct).dividedBy(100)
  );
}

/** Expected contribution adjusted for attendance probability */
export function expectedContributionWithAttendance(
  contributionWhenAttended: Decimal,
  attendanceProbabilityPct: number
): Decimal {
  return contributionWhenAttended.times(
    d(attendanceProbabilityPct).dividedBy(100)
  );
}

export function contributionTrace(
  label: string,
  assumptions: FinanceAssumptions,
  netRevenuePerSession: Decimal,
  result: Decimal
): CalculationTrace {
  const variable = variableCostPerAttendedSeat(assumptions);
  const payment = paymentFeeOnNet(assumptions, netRevenuePerSession);
  return trace(
    label,
    "net revenue − variable cost per seat − payment fee",
    "INR/session",
    [
      {
        label: "Net revenue per session",
        expression: netRevenuePerSession.toString(),
        result: netRevenuePerSession,
      },
      {
        label: "Variable cost per attended seat",
        expression: variable.toString(),
        result: variable,
      },
      {
        label: "Payment fee",
        expression: payment.toString(),
        result: payment,
      },
      {
        label: "Contribution",
        expression: `${netRevenuePerSession.toString()} − ${variable.toString()} − ${payment.toString()}`,
        result,
      },
    ],
    result
  );
}

/** Convert net price to gross for GST-inclusive global mode */
export function netToGrossPrice(
  assumptions: FinanceAssumptions,
  netPrice: Decimal
): Decimal {
  if (assumptions.priceEntryMode === "exclusive") {
    return netPrice.times(
      d(1).plus(d(assumptions.gstRatePct).dividedBy(100))
    );
  }
  return netPrice;
}

/** Solve net revenue per session for target contribution per attended session */
export function netRevenueForTargetContribution(
  assumptions: FinanceAssumptions,
  targetContribution: Decimal
): Decimal {
  const variable = variableCostPerAttendedSeat(assumptions);
  const paymentRate = d(assumptions.paymentGatewayPct).dividedBy(100);
  return targetContribution.plus(variable).dividedBy(d(1).minus(paymentRate));
}

export { WEEKS_PER_MONTH };
