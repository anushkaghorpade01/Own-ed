"use client";

import { useFinanceModel } from "@/hooks/use-finance-model";
import { SectionHeader, SampleBanner, MetricCard, BusinessInsightCard } from "@/components/shared/metric-card";
import { explainContributionMargin } from "@/lib/finance/business-insights";
import { formatINR } from "@/lib/format/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UnitEconomicsPage() {
  const model = useFinanceModel();
  const ue = model.unitEconomics;
  const marginInsight = explainContributionMargin(model);

  return (
    <div>
      <SectionHeader
        title="Unit Economics"
        description="What is one seat, one class, and one reformer actually worth to the business?"
      />
      <SampleBanner />

      <div className="mb-8">
        <BusinessInsightCard {...marginInsight} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="CM1 / occupied seat"
          value={formatINR(ue.perSeat.contributionMarginPerSeat)}
          businessInsight={`After direct costs, each person who shows up leaves ${formatINR(ue.perSeat.contributionMarginPerSeat)} toward rent and salaries. A full class of ${model.assumptions.maxGroupClassSize} = ${formatINR(ue.perSeat.contributionMarginPerSeat.times(model.assumptions.maxGroupClassSize))}.`}
          trace={ue.perSeat.trace}
        />
        <MetricCard
          label="Net sales / reformer / month"
          value={formatINR(ue.perReformer.revenuePerReformer)}
          businessInsight={`Each reformer generates ${formatINR(ue.perReformer.revenuePerReformer)}/month in net sales at current occupancy. A 4th reformer would add ~33% more capacity but also ~₹1.5L+ in equipment cost.`}
        />
        <MetricCard
          label="Utilisation / reformer"
          value={`${ue.perReformer.utilisationPct.toFixed(1)}%`}
          businessInsight={`Each reformer is booked ${ue.perReformer.utilisationPct.toFixed(0)}% of available time. Under-used reformers are expensive floor space.`}
        />
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Per class economics — what each occupancy level earns</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-[#6B6560]">
            Per-class economics for delivered services only. Contribution (CM1) = net sales minus direct variable costs.
            Fully loaded subtracts a share of monthly fixed costs — see{" "}
            <a href="/math/dictionary" className="underline">Dictionary</a>.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#F0EBE3] text-left text-xs text-[#A39E98]">
                  <th className="pb-2 pr-4">Occupancy</th>
                  <th className="pb-2 pr-4">Net sales</th>
                  <th className="pb-2 pr-4">Direct costs</th>
                  <th className="pb-2 pr-4">Contribution (CM1)</th>
                  <th className="pb-2">Fully loaded</th>
                </tr>
              </thead>
              <tbody>
                {ue.perClass.map((c) => (
                  <tr key={c.occupancy} className="border-b border-[#FAF8F5]">
                    <td className="py-2 pr-4 font-medium">
                      {c.occupancy} / {c.capacity}
                      {c.occupancy === 0 && <span className="ml-2 text-xs text-[#A39E98]">— direct instructor cost if class runs</span>}
                    </td>
                    <td className="py-2 pr-4">{formatINR(c.netRevenue)}</td>
                    <td className="py-2 pr-4">{formatINR(c.directVariableCosts.plus(c.instructorVariableCost))}</td>
                    <td className={`py-2 pr-4 ${c.contributionMargin.gte(0) ? "text-[#3D5C3D]" : "text-[#8B3A3A]"}`}>
                      {formatINR(c.contributionMargin)}
                    </td>
                    <td className="py-2">{formatINR(c.fullyLoadedProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
