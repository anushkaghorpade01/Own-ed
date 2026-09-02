"use client";

import { Plus, Trash2 } from "lucide-react";
import { useApp } from "@/lib/store/app-store";
import { useFinanceModel } from "@/hooks/use-finance-model";
import { formatINR } from "@/lib/format/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CrudSelect } from "@/components/shared/crud-select";
import { newFundingEvent } from "@/lib/finance/engine/investment-recovery";
import type { FundingEvent } from "@/lib/finance/schemas";

const FUNDING_TYPES = ["founder_equity", "loan", "grant", "other"] as const;

export function FundingPlanEditor() {
  const { state, updateAssumptions } = useApp();
  const model = useFinanceModel();
  const launch = model.cashFlow.launch;
  const health = model.cashFlow.cashHealth;
  const a = state.assumptions;
  const events = a.additionalFundingEvents ?? [];

  const setEvents = (next: FundingEvent[]) => {
    updateAssumptions({ additionalFundingEvents: next });
  };

  const applyPlannedFounderTotal = () => {
    updateAssumptions({
      founderEquity: Math.round(health.plannedFounderEquityTotal.toNumber()),
    });
  };

  const hasShortfall = health.founderEquityTopUpSuggested.gt(0);

  return (
    <div className="space-y-4">
      <p className="text-xs text-[#6B6560]">
        For now, all launch and early liquidity is modeled as <strong>founder equity</strong> — one
        planning bucket covering your own cash plus anything you&apos;d raise from friends &amp;
        family later. Stake splits and revenue share are not modeled yet.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div className="rounded-lg border border-[#F0EBE3] px-3 py-2">
          <p className="text-xs text-[#A39E98]">Founder equity (entered)</p>
          <p className="font-medium">{formatINR(launch.founderEquity)}</p>
        </div>
        <div className="rounded-lg border border-[#F0EBE3] px-3 py-2">
          <p className="text-xs text-[#A39E98]">Founder equity (planning total)</p>
          <p className="font-medium text-[#2C2825]">
            {formatINR(health.plannedFounderEquityTotal)}
          </p>
          {hasShortfall && (
            <p className="text-caption mt-0.5 text-[#A39E98]">
              incl. {formatINR(health.founderEquityTopUpSuggested)} shortfall
            </p>
          )}
        </div>
        <div className="rounded-lg border border-[#F0EBE3] px-3 py-2">
          <p className="text-xs text-[#A39E98]">Cash required at launch</p>
          <p className="font-medium">{formatINR(launch.totalCashRequiredAtLaunch)}</p>
        </div>
        <div className="rounded-lg border border-[#F0EBE3] px-3 py-2">
          <p className="text-xs text-[#A39E98]">Loan funding</p>
          <p className="font-medium">{formatINR(launch.loanAmount)}</p>
        </div>
      </div>

      {hasShortfall && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#E8E2D9] bg-[#FAF8F5] px-4 py-3 text-sm text-[#6B6560]">
          <p className="flex-1 min-w-[200px]">
            Your entered founder equity is {formatINR(health.founderEquityTopUpSuggested)} short of
            what the bank cash model needs at its lowest point. For planning, treat the{" "}
            <strong>{formatINR(health.plannedFounderEquityTotal)}</strong> total as the full
            founder-side raise (you + future F&amp;F) until stake split is added.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={applyPlannedFounderTotal}>
            Set founder equity to {formatINR(health.plannedFounderEquityTotal)}
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between">
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
          No scheduled follow-on injections. Use founder equity for the full planning total above.
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
