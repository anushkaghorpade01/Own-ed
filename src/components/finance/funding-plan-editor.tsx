"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useApp } from "@/lib/store/app-store";
import { useFinancingModel, useFinancingDraftDirty } from "@/hooks/use-financing-model";
import { formatINR } from "@/lib/format/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CrudSelect } from "@/components/shared/crud-select";
import { Explainer } from "@/components/ui/explainer";
import { newFundingEvent } from "@/lib/finance/engine/investment-recovery";
import {
  buildFundingBridgeToLowPoint,
  formatFundingBridgeExplainer,
  formatLaunchCashExplainer,
} from "@/lib/finance/engine/funding-bridge";
import type { FundingEvent } from "@/lib/finance/schemas";

const FUNDING_TYPES = ["founder_equity", "loan", "grant", "other"] as const;

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-[#F0EBE3] px-3 py-2">
      <p className="text-xs text-[#A39E98]">{label}</p>
      <p className="font-medium text-[#2C2825]">{value}</p>
      {hint ? <p className="text-caption mt-0.5 text-[#A39E98]">{hint}</p> : null}
    </div>
  );
}

export function FundingPlanEditor() {
  const { state, updateAssumptions } = useApp();
  const model = useFinancingModel();
  const draftDirty = useFinancingDraftDirty();
  const [showApplyFunding, setShowApplyFunding] = useState(false);

  const launch = model.cashFlow.launch;
  const health = model.cashFlow.cashHealth;
  const a = model.assumptions;
  const events = state.assumptions.additionalFundingEvents ?? [];

  const otherFunding = launch.additionalFundingTotal;
  const loanFunding = launch.loanAmount;
  const founderPlanned = launch.founderEquity;
  const hasGap = health.fundingGap.gt(0);

  const bridge = buildFundingBridgeToLowPoint(
    a,
    model.cashFlow.monthly,
    launch,
    health.lowestBankCashMonth
  );

  const setEvents = (next: FundingEvent[]) => {
    updateAssumptions({ additionalFundingEvents: next });
  };

  return (
    <div className="space-y-6">
      {draftDirty && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Previewing unsaved funding inputs — save the section above to persist and update all
          dashboards.
        </p>
      )}

      <div>
        <p className="text-label mb-3">How much are you planning to fund?</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <SummaryCard label="Founder funding planned" value={formatINR(founderPlanned)} />
          <SummaryCard label="Loan / other funding" value={formatINR(loanFunding.plus(otherFunding))} />
          <SummaryCard
            label="Total planned funding"
            value={formatINR(health.totalPlannedFunding)}
            hint="Founder + loan + scheduled injections"
          />
        </div>
      </div>

      <div>
        <p className="text-label mb-3">What does the model think you need?</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <SummaryCard
            label="Cash required at launch"
            value={formatINR(launch.totalCashRequiredAtLaunch)}
          />
          <SummaryCard
            label="Opening cash after launch"
            value={formatINR(launch.openingBankCashAfterLaunch)}
          />
          <SummaryCard
            label="Lowest bank cash"
            value={formatINR(health.lowestBankCash)}
            hint={`Month ${health.lowestBankCashMonth}`}
          />
          {hasGap ? (
            <SummaryCard
              label="Funding gap"
              value={formatINR(health.fundingGap)}
              hint={`Minimum total required ${formatINR(health.minimumTotalFundingRequired)}`}
            />
          ) : (
            <SummaryCard
              label="Funding surplus"
              value={formatINR(health.fundingSurplus)}
              hint="Cushion at lowest cash point"
            />
          )}
        </div>

        {hasGap && (
          <p className="mt-3 text-xs text-[#6B6560]">
            Additional funding required:{" "}
            <strong>{formatINR(health.fundingGap)}</strong> beyond your current plan. You may
            close this gap with more equity, a loan, lower capex, or revised operating assumptions
            — the model will not change your planned founder funding automatically.
          </p>
        )}

        <Explainer
          trigger="How is this calculated?"
          className="mt-3"
          sections={[
            {
              title: "Cash required at launch",
              content: formatLaunchCashExplainer(launch).join("\n"),
            },
            {
              title: "Funding gap",
              content: formatFundingBridgeExplainer(
                bridge,
                launch,
                health.fundingGap,
                health.lowestBankCash,
                health.lowestBankCashMonth
              ).join("\n"),
            },
            {
              title: "What funding does not affect",
              content:
                "Founder funding, loans, and injections change bank cash only. They do not change revenue, EBITDA, operating profit, or the payback investment hurdle.",
            },
          ]}
        />

        {hasGap && showApplyFunding && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-[#E8E2D9] bg-[#FAF8F5] px-4 py-3 text-sm text-[#6B6560]">
            <p className="flex-1 min-w-[200px]">
              Copy the model&apos;s minimum total funding ({formatINR(health.minimumTotalFundingRequired)})
              into founder funding? This overwrites your current planned amount — only use if you
              want to match the model recommendation.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                updateAssumptions({
                  founderEquity: Math.round(health.minimumTotalFundingRequired.toNumber()),
                });
                setShowApplyFunding(false);
              }}
            >
              Apply recommended funding amount
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowApplyFunding(false)}
            >
              Cancel
            </Button>
          </div>
        )}

        {hasGap && !showApplyFunding && (
          <button
            type="button"
            className="mt-2 text-body-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            onClick={() => setShowApplyFunding(true)}
          >
            Apply recommended funding amount…
          </button>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[#F0EBE3] pt-4">
        <p className="text-label">Additional funding events (optional)</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setEvents([newFundingEvent(), ...events])}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add injection
        </Button>
      </div>

      {events.length === 0 ? (
        <p className="text-body-sm text-[var(--text-muted)]">
          No scheduled follow-on injections beyond launch funding above.
        </p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex flex-wrap items-end gap-2 rounded-lg border border-[#F0EBE3] p-3"
            >
              <CrudSelect
                value={event.type}
                options={FUNDING_TYPES}
                onChange={(type) =>
                  setEvents(
                    events.map((e) =>
                      e.id === event.id ? { ...e, type: type as FundingEvent["type"] } : e
                    )
                  )
                }
                aria-label="Funding type"
              />
              <Input
                type="number"
                className="w-32"
                value={event.amount}
                onChange={(e) =>
                  setEvents(
                    events.map((ev) =>
                      ev.id === event.id ? { ...ev, amount: Number(e.target.value) } : ev
                    )
                  )
                }
                aria-label="Amount"
              />
              <Input
                type="number"
                className="w-20"
                value={event.month}
                min={0}
                max={36}
                onChange={(e) =>
                  setEvents(
                    events.map((ev) =>
                      ev.id === event.id ? { ...ev, month: Number(e.target.value) } : ev
                    )
                  )
                }
                aria-label="Month"
              />
              <span className="text-caption pb-2">month</span>
              <Input
                className="min-w-[120px] flex-1"
                placeholder="Note"
                value={event.note ?? ""}
                onChange={(e) =>
                  setEvents(
                    events.map((ev) =>
                      ev.id === event.id ? { ...ev, note: e.target.value } : ev
                    )
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-red-600"
                onClick={() => setEvents(events.filter((ev) => ev.id !== event.id))}
                aria-label="Remove funding event"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
