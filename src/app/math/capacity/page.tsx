"use client";

import { useFinanceModel } from "@/hooks/use-finance-model";
import { generateSchedulingRecommendations } from "@/lib/finance/engine/capacity";
import { useApp } from "@/lib/store/app-store";
import {
  MetricCard,
  SectionHeader,
  SampleBanner,
  BusinessInsightCard,
  CollapsibleSection,
} from "@/components/shared/metric-card";
import {
  explainUtilisation,
  explainUnrealisedRevenueOpportunity,
  explainCreditCoverage,
  explainBreakage,
  FINANCE_TERMINOLOGY,
} from "@/lib/finance/business-insights";
import { formatINR, formatPercent } from "@/lib/format/currency";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricLabel, InfoTooltip } from "@/components/ui/info-tooltip";
import Link from "next/link";
import {
  CREDIT_LIABILITY_GUIDE_HREF,
  CREDIT_LIABILITY_GUIDE_LINK_LABEL,
  CREDIT_LIABILITY_SECTION_INTRO,
  CREDIT_LIABILITY_TWO_QUESTIONS,
  CREDIT_LIABILITY_ROW_TOOLTIPS,
  CREDIT_LIABILITY_RATIO_TOOLTIPS,
} from "@/lib/finance/credit-liability-copy";

const statusVariant = {
  no_expansion: "secondary" as const,
  healthy: "success" as const,
  monitor: "warning" as const,
  constrained: "warning" as const,
  expansion: "danger" as const,
};

export default function CapacityPage() {
  const model = useFinanceModel();
  const { state } = useApp();
  const recommendations = generateSchedulingRecommendations(state.assumptions);
  const utilInsight = explainUtilisation(model);
  const opportunityInsight = explainUnrealisedRevenueOpportunity(model);
  const creditInsight = explainCreditCoverage(model);
  const breakageInsight = explainBreakage(model);
  const cl = model.creditLiability;
  const uc = model.unusedCapacity;

  return (
    <div>
      <SectionHeader
        title="Capacity"
        description="Physical capacity, expected bookings, and credit service obligations — distinct from earned revenue and cash collected."
      />
      <SampleBanner />

      <div className="mb-6">
        <CollapsibleSection
          title="Key distinctions"
          defaultOpen={false}
          action={
            <span className="text-xs text-[#A39E98]">
              {FINANCE_TERMINOLOGY.length} terms
            </span>
          }
        >
          <p className="mb-3 text-xs text-[#6B6560]">
            Quick glossary for capacity, occupancy, credits, and profit — same terms as the Finance
            Dictionary.
          </p>
          <dl className="grid gap-3 sm:grid-cols-2">
            {FINANCE_TERMINOLOGY.map(({ term, definition }) => (
              <div key={term}>
                <dt className="text-xs font-medium text-[#2C2825]">{term}</dt>
                <dd className="mt-0.5 text-xs text-[#6B6560]">{definition}</dd>
              </div>
            ))}
          </dl>
        </CollapsibleSection>
      </div>

      <div className="mb-8 grid gap-4">
        <BusinessInsightCard {...utilInsight} />
        <BusinessInsightCard {...opportunityInsight} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total physical capacity"
          value={uc.totalPhysicalCapacity.toFixed(0)}
          subtitle="Scheduled reformer spots / month"
          trace={model.capacity.traces.monthlySeats}
        />
        <MetricCard
          label="Expected occupied"
          value={uc.expectedOccupiedCapacity.toFixed(0)}
          subtitle={`${state.assumptions.projectedBookedOccupancyPct}% booked occupancy`}
          trace={model.capacity.traces.occupiedSeats}
        />
        <MetricCard
          label="Unused capacity"
          value={uc.unusedCapacity.toFixed(0)}
          subtitle="Not booked under this scenario"
          businessInsight="Scheduled spots not expected to be booked. This is not a financial loss."
        />
        <MetricCard
          label="Attended / month"
          value={model.capacity.attendedSeatsMonthly.toFixed(0)}
          subtitle="After cancellations & no-shows"
        />
      </div>

      <Card className="mt-6 border-dashed border-[#E0DAD2] bg-[#FDFBF7]">
        <CardHeader>
          <CardTitle className="text-sm">Unrealised revenue opportunity (theoretical)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[#6B6560]">{opportunityInsight.explanation}</p>
          <p className="text-kpi-secondary mt-2">
            Up to {formatINR(uc.unrealisedRevenueOpportunity)}/month
          </p>
          <p className="mt-2 text-[10px] text-[#A39E98]">
            Not included in P&L, cash flow, contribution, or payback calculations.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <CardTitle>Credit liability / service obligation</CardTitle>
              <InfoTooltip
                wide
                label="About credit liability on Capacity"
                content={`${CREDIT_LIABILITY_TWO_QUESTIONS}\n\n${CREDIT_LIABILITY_SECTION_INTRO}`}
              />
            </div>
            <Link
              href={CREDIT_LIABILITY_GUIDE_HREF}
              className="text-xs font-medium text-[#C4A882] underline-offset-2 hover:underline"
            >
              {CREDIT_LIABILITY_GUIDE_LINK_LABEL} →
            </Link>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-[#6B6560]">
            {CREDIT_LIABILITY_TWO_QUESTIONS} Numbers update when you change occupancy or credit
            assumptions.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <BusinessInsightCard {...creditInsight} />
          {breakageInsight && <BusinessInsightCard {...breakageInsight} />}

          {cl.slotConstraintDetected && (
            <div className="rounded-lg border border-[#E8DFC8] bg-[#FDF9F0] px-4 py-3 text-sm text-[#8B6914]">
              <p>{cl.slotConstraintWarning}</p>
              <Link
                href={CREDIT_LIABILITY_GUIDE_HREF}
                className="mt-2 inline-block text-xs font-medium text-[#8B6914] underline underline-offset-2"
              >
                Why this happens — read the Guide →
              </Link>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {[
                  ["Total physical capacity", cl.totalPhysicalCapacity, "All scheduled spots"],
                  ["Expected occupied capacity", cl.expectedOccupiedCapacity, "Already expected to be booked"],
                  ["Uncommitted / remaining capacity", cl.uncommittedRemainingCapacity, "Open for additional bookings"],
                  ["Outstanding credits", cl.outstandingCredits, "Credits sold, not yet redeemed"],
                  ["Expected redemptions before expiry", cl.expectedRedemptionBeforeExpiry, "Forecast demand on credits"],
                  ["Eligible capacity for credits", cl.eligibleCapacityForCredits, "Uncommitted spots credits could use"],
                  ["Peak-time eligible capacity", cl.peakTimeEligibleCapacity, "Open peak/eligible slots only"],
                  ["Credits expected to expire unused (breakage)", cl.creditsExpectedToExpireUnused, "Separate from unused studio capacity"],
                ].map(([label, value, note]) => (
                  <tr key={String(label)} className="border-b border-[#FAF8F5]">
                    <td className="py-2 pr-4 text-[#6B6560]">
                      <span className="inline-flex items-center gap-1.5">
                        <span>{String(label)}</span>
                        {CREDIT_LIABILITY_ROW_TOOLTIPS[String(label)] && (
                          <InfoTooltip
                            wide
                            content={CREDIT_LIABILITY_ROW_TOOLTIPS[String(label)]!}
                            label={`About ${String(label)}`}
                          />
                        )}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-medium text-[#2C2825]">
                      {typeof value === "object" && "toFixed" in value ? (value as { toFixed: (n: number) => string }).toFixed(0) : String(value)}
                    </td>
                    <td className="py-2 text-xs text-[#A39E98]">{String(note)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-[#FAF8F5] p-4">
              <MetricLabel
                label="Eligible coverage ratio"
                wide
                tooltip={CREDIT_LIABILITY_RATIO_TOOLTIPS.eligibleCoverage}
              />
              <p className="text-kpi-secondary">{cl.eligibleCoverageRatio.toFixed(2)}×</p>
              <Badge variant={cl.status === "green" ? "success" : cl.status === "amber" ? "warning" : "danger"} className="mt-1">
                {cl.status.toUpperCase()}
              </Badge>
              <p className="mt-1 text-[10px] text-[#A39E98]">Uncommitted / expected redemptions</p>
            </div>
            <div className="rounded-lg bg-[#FAF8F5] p-4">
              <MetricLabel
                label="Peak-time eligible coverage"
                wide
                tooltip={CREDIT_LIABILITY_RATIO_TOOLTIPS.peakCoverage}
              />
              <p className="text-kpi-secondary">{cl.peakCoverageRatio.toFixed(2)}×</p>
              <Badge variant={cl.peakStatus === "green" ? "success" : cl.peakStatus === "amber" ? "warning" : "danger"} className="mt-1">
                {cl.peakStatus.toUpperCase()}
              </Badge>
              <p className="mt-1 text-[10px] text-[#A39E98]">Peak open slots / expected redemptions</p>
            </div>
            <div className="rounded-lg bg-[#FAF8F5] p-4 opacity-60">
              <MetricLabel
                label="Naive total capacity ratio (misleading)"
                wide
                tooltip={CREDIT_LIABILITY_RATIO_TOOLTIPS.naiveCoverage}
              />
              <p className="text-kpi-secondary">{cl.naiveTotalCapacityCoverageRatio.toFixed(2)}×</p>
              <p className="mt-1 text-[10px] text-[#A39E98]">Total physical / redemptions — ignores existing bookings</p>
            </div>
          </div>

          <p className="text-xs text-[#6B6560]">{cl.warning}</p>
          <p className="text-xs text-[#6B6560]">
            <Link
              href={CREDIT_LIABILITY_GUIDE_HREF}
              className="font-medium text-[#C4A882] underline-offset-2 hover:underline"
            >
              {CREDIT_LIABILITY_GUIDE_LINK_LABEL} →
            </Link>
          </p>
        </CardContent>
      </Card>

      {model.capacity.slotCapacity.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Capacity by time slot</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#F0EBE3] text-left text-xs text-[#A39E98]">
                    <th className="pb-2 pr-4">Slot</th>
                    <th className="pb-2 pr-4">Available</th>
                    <th className="pb-2 pr-4">Booked</th>
                    <th className="pb-2">Occupancy</th>
                  </tr>
                </thead>
                <tbody>
                  {model.capacity.slotCapacity.map((slot, i) => (
                    <tr key={i} className="border-b border-[#FAF8F5]">
                      <td className="py-2 pr-4 capitalize text-[#2C2825]">{slot.day} {slot.startTime}</td>
                      <td className="py-2 pr-4 text-[#6B6560]">{slot.available.toFixed(0)}</td>
                      <td className="py-2 pr-4 text-[#6B6560]">{slot.booked.toFixed(0)}</td>
                      <td className="py-2 text-[#2C2825]">
                        {Math.round(slot.booked.dividedBy(slot.available.dividedBy(4.333)).toNumber())} / {slot.capacity}{" "}
                        ({formatPercent(slot.bookedOccupancyPct)})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {recommendations.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Scheduling recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendations.map((r) => (
              <div key={r.slot} className="rounded-lg border border-[#F0EBE3] p-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[#2C2825]">{r.slot}</span>
                  <Badge variant={statusVariant[r.status]}>{r.status.replace("_", " ")}</Badge>
                  <span className="text-xs text-[#A39E98]">{r.avgUtilisation} avg</span>
                </div>
                <p className="mt-1 text-sm text-[#6B6560]">{r.suggestion}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
