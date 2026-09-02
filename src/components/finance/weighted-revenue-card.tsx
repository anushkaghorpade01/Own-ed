"use client";

import { useFinanceModel } from "@/hooks/use-finance-model";
import { formatINR } from "@/lib/format/currency";
import { Explainer } from "@/components/ui/explainer";
import { FinanceTable, FinanceTableRow } from "@/components/ui/finance-table";
import { InfoTooltip, MetricLabel, TableHeaderWithTooltip } from "@/components/ui/info-tooltip";

const GROUP_NET_SALES_TOOLTIP =
  "Average net sales per occupied flexible (group) booking, weighted by Drop-In and credit pack shares within the flexible cohort. The flexible mix is normalized to 100% — Private is excluded. Changing Private's share of total bookings does not change this metric.";

const BLENDED_NET_SALES_TOOLTIP =
  "Average net sales per occupied reformer booking across all base services (Drop-In, packs, and Private), weighted by service demand mix. This studio-level metric feeds P&L, break-even, and Optimise.";

const BLENDED_CONTRIBUTION_TOOLTIP =
  "Average contribution (net sales minus direct variable costs) per occupied reformer booking, weighted by service demand mix. Same mix weights as blended net sales, but after payment fees, consumables, and instructor variable costs.";

const WEIGHTED_NET_SALES_TOOLTIP =
  "That service's booking mix % × its net sales per booking. Each row's value is its share of the blended net sales / spot total.";

const CONTRIBUTION_PER_BOOKING_TOOLTIP =
  "Net sales per booking minus direct variable costs to deliver that booking (payment fees, consumables, instructor variable payout). Private uses its own delivery cost rules.";

const WEIGHTED_CONTRIBUTION_TOOLTIP =
  "That service's booking mix % × its contribution per booking. Each row's value is its share of the blended contribution / spot total.";

export function WeightedRevenueCard() {
  const model = useFinanceModel();
  const weighted = model.revenue.weightedRevenue;
  const economics = weighted.serviceBookingBreakdown;

  return (
    <section className="card-surface page-section">
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <MetricLabel
            label="Group / flexible net sales / occupied spot"
            tooltip={GROUP_NET_SALES_TOOLTIP}
          />
          <p className="text-metric-value mt-[var(--space-card-title-value)]">
            {formatINR(weighted.weightedGroupNetSalesPerOccupiedSpot)}
          </p>
          <p className="text-body-sm mt-1 text-[var(--text-secondary)]">
            Drop-In + 8-Pack + 16-Pack only. Private excluded.
          </p>
        </div>
        <div>
          <MetricLabel
            label="Blended net sales / occupied reformer spot"
            tooltip={BLENDED_NET_SALES_TOOLTIP}
          />
          <p className="text-metric-value mt-[var(--space-card-title-value)]">
            {formatINR(weighted.blendedNetSalesPerOccupiedSpot)}
          </p>
          <p className="text-body-sm mt-1 text-[var(--text-secondary)]">
            All base services including Private — studio-level planning metric.
          </p>
          <p className="text-caption mt-1 inline-flex items-center gap-1 text-[var(--text-muted)]">
            <span>
              Blended contribution / spot:{" "}
              {formatINR(weighted.blendedContributionPerOccupiedSpot)}
            </span>
            <InfoTooltip
              content={BLENDED_CONTRIBUTION_TOOLTIP}
              label="About blended contribution per spot"
            />
          </p>
        </div>
      </div>

      <Explainer
        trigger="How is this calculated?"
        sections={[
          {
            title: "Service booking mix",
            content:
              "Each row is service demand mix % × net sales per occupied booking. This is share of occupied reformer bookings — not customer count or packs purchased.",
          },
          {
            title: "Blended vs group",
            content:
              "Group/flexible average is per occupied flexible booking — mix among Drop-In and packs is normalized to 100% within that cohort. Blended includes Private at its booking share and feeds P&L, break-even, and Optimise.",
          },
        ]}
      />

      {!weighted.mixValid && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-body-sm text-amber-900">
          Service demand mix must equal 100% (currently {weighted.mixTotal.toString()}%).
          Edit on Access Products → Mix.
        </div>
      )}

      <div className="mt-4">
        <p className="text-label mb-2">Net sales by service</p>
        <FinanceTable
          headers={[
            "Service",
            "Booking mix",
            "Net sales / booking",
            <TableHeaderWithTooltip
              key="weighted-net"
              label="Weighted net sales"
              tooltip={WEIGHTED_NET_SALES_TOOLTIP}
              align="right"
            />,
            <TableHeaderWithTooltip
              key="contribution"
              label="Contribution / booking"
              tooltip={CONTRIBUTION_PER_BOOKING_TOOLTIP}
              align="right"
            />,
            <TableHeaderWithTooltip
              key="weighted-contribution"
              label="Weighted contribution"
              tooltip={WEIGHTED_CONTRIBUTION_TOOLTIP}
              align="right"
            />,
          ]}
        >
          {economics.map((row) => (
            <FinanceTableRow
              key={row.product.id}
              cells={[
                row.product.name,
                `${row.serviceBookingMixPct.toFixed(1)}%`,
                formatINR(row.netSalesPerOccupiedBooking),
                formatINR(row.weightedNetSalesImpact),
                formatINR(row.contributionPerOccupiedBooking),
                formatINR(row.weightedContributionImpact),
              ]}
            />
          ))}
          <FinanceTableRow
            bold
            cells={[
              "Total",
              `${weighted.mixTotal.toFixed(1)}%`,
              "—",
              formatINR(weighted.blendedNetSalesPerOccupiedSpot),
              "—",
              formatINR(weighted.blendedContributionPerOccupiedSpot),
            ]}
          />
        </FinanceTable>
      </div>
    </section>
  );
}
