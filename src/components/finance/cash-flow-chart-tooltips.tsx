"use client";

import { formatINR } from "@/lib/format/currency";
import { formatRecoveryPositionFromNumber } from "@/lib/finance/engine/recovery-position";

export interface InvestmentRecoveryTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: Record<string, number> }>;
  label?: string | number;
}

export function InvestmentRecoveryTooltip({
  active,
  payload,
  label,
}: InvestmentRecoveryTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const month = Number(label ?? row.month ?? 0);
  const positionNum = Number(row.recoveryPosition ?? row.investmentRemaining ?? 0);
  const { label: labelText, amount } = formatRecoveryPositionFromNumber(positionNum);

  return (
    <div className="rounded-lg border border-[#E8E2D9] bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-[#2C2825]">
        {month === 0 ? "Month 0 — before trading" : `Month ${month}`}
      </p>
      <div className="mt-2 space-y-1 text-[#6B6560]">
        <p>
          {labelText}:{" "}
          <span className="font-medium text-[#2C2825]">{formatINR(amount)}</span>
        </p>
        {month > 0 && (
          <>
            <p>
              Cash generated this month:{" "}
              <span className="font-medium text-[#2C2825]">
                {formatINR(row.monthOperatingCash ?? 0)}
              </span>
            </p>
            <p>
              Cumulative cash generated:{" "}
              <span className="font-medium text-[#2C2825]">
                {formatINR(row.cumulativeOperatingCashGenerated ?? 0)}
              </span>
            </p>
          </>
        )}
        {row.initialInvestment != null && (
          <p>
            Initial investment:{" "}
            <span className="font-medium text-[#2C2825]">
              {formatINR(row.initialInvestment)}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

export interface BankCashTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: Record<string, number> }>;
  label?: string | number;
}

export function BankCashTooltip({ active, payload, label }: BankCashTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const month = Number(label ?? row.month ?? 0);

  return (
    <div className="rounded-lg border border-[#E8E2D9] bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-[#2C2825]">
        {month === 0 ? "Month 0 — after launch payments" : `Month ${month}`}
      </p>
      <div className="mt-2 space-y-1 text-[#6B6560]">
        <p>
          Ending bank cash:{" "}
          <span className="font-medium text-[#2C2825]">
            {formatINR(row.bankCashBalance ?? 0)}
          </span>
        </p>
        {month === 0 && row.openingBankCashAfterLaunch != null && (
          <p className="text-[#A39E98]">After funding − capex − deposit, before trading</p>
        )}
        {month > 0 && (
          <>
            <p>
              Cash collected (operating):{" "}
              <span className="font-medium text-[#2C2825]">
                {formatINR(row.cashInflows ?? 0)}
              </span>
            </p>
            <p>
              Cash paid (operating):{" "}
              <span className="font-medium text-[#2C2825]">
                {formatINR(row.cashOutflows ?? 0)}
              </span>
            </p>
            <p>
              Net operating this month:{" "}
              <span className="font-medium text-[#2C2825]">
                {formatINR(row.monthOperatingCash ?? 0)}
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export function formatRecoveryPositionInr(position: number): {
  label: string;
  amount: number;
} {
  return formatRecoveryPositionFromNumber(position);
}
