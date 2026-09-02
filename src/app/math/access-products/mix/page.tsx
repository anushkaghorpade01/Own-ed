"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/store/app-store";
import { useFinanceModel } from "@/hooks/use-finance-model";
import { SectionHeader } from "@/components/shared/metric-card";
import { ServiceDemandMixCard } from "@/components/finance/service-demand-mix-card";
import { analyzePrivateEconomics } from "@/lib/finance/engine/private-economics";
import { formatINR, formatPercent } from "@/lib/format/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProductMixPage() {
  const { state, updateAssumptions } = useApp();
  const model = useFinanceModel();
  const [slotBand, setSlotBand] = useState<"peak" | "standard" | "off_peak">("standard");
  const privateEcon = useMemo(
    () => analyzePrivateEconomics(state.assumptions, slotBand),
    [state.assumptions, slotBand]
  );

  return (
    <div>
      <SectionHeader
        title="Service Demand Mix"
        description="Simple 100% planning mix — the engine translates this into credits, spots, sessions, and contribution."
      />

      <ServiceDemandMixCard />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-h3">Optional products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-body-sm">
            <label className="flex items-center justify-between gap-2">
              <span>Standing Spot</span>
              <input
                type="checkbox"
                checked={state.assumptions.standingSpotEnabled ?? false}
                onChange={(e) => updateAssumptions({ standingSpotEnabled: e.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span>Standby</span>
              <input
                type="checkbox"
                checked={state.assumptions.standbyEnabled ?? false}
                onChange={(e) => updateAssumptions({ standbyEnabled: e.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span>Private requires exclusive studio</span>
              <input
                type="checkbox"
                checked={state.assumptions.privateRequiresExclusiveStudio ?? false}
                onChange={(e) => updateAssumptions({ privateRequiresExclusiveStudio: e.target.checked })}
              />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-h3">Private economics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-body-sm">
            <div className="flex gap-2">
              {(["peak", "standard", "off_peak"] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setSlotBand(b)}
                  className={`rounded px-2 py-1 text-caption capitalize ${
                    slotBand === b ? "bg-[var(--text-primary)] text-white" : "bg-[var(--surface-muted)]"
                  }`}
                >
                  {b.replace("_", "-")}
                </button>
              ))}
            </div>
            <p>
              Current net sales/session: {formatINR(privateEcon.netRevenuePerSession)} · Contribution/session:{" "}
              {formatINR(privateEcon.contributionPerSession)}
            </p>
            <p>Customer pays incl. GST: {formatINR(privateEcon.grossRevenuePerSession)}</p>
            <p>Economic price floor: {formatINR(privateEcon.economicPriceFloor)}</p>
            <p>Premium vs flexible group: {formatPercent(privateEcon.premiumVsFlexibleGroupPct)}</p>
            <p className="text-[var(--text-secondary)]">{privateEcon.insight}</p>
            <p className="text-caption mt-2">
              Private should generally command a meaningful premium because OWN provides 1:1 attention
              with less operating leverage than a group booking.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-h3">Engine output (from canonical model)</CardTitle>
        </CardHeader>
        <CardContent className="text-body-sm text-[var(--text-secondary)]">
          <p>Weighted net / redeemed credit: {formatINR(model.revenue.weightedRevenue.weightedNetRevenuePerCredit)}</p>
          <p>Private revenue (monthly): {formatINR(model.revenue.privateRevenue)}</p>
          <p>Net profit: {formatINR(model.pl.netProfit)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
