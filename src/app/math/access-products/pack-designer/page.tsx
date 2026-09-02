"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/store/app-store";
import { useFinanceModel } from "@/hooks/use-finance-model";
import {
  analyzeFlexiblePack,
  estimateSafePackSales,
  listFlexiblePacks,
} from "@/lib/finance/engine/flexible-packs";
import { SectionHeader, SampleBanner } from "@/components/shared/metric-card";
import { formatINR, formatPercent } from "@/lib/format/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const STATUS_LABEL: Record<string, string> = {
  comfortable: "Comfortable",
  tight: "Tight",
  overcommitted: "Overcommitted",
};

export default function PackDesignerPage() {
  const { state } = useApp();
  const model = useFinanceModel();
  const packs = listFlexiblePacks(state.assumptions);
  const [selectedId, setSelectedId] = useState(packs[0]?.id ?? "8-pack");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [safeSalesCount, setSafeSalesCount] = useState(5);

  const product = packs.find((p) => p.id === selectedId) ?? packs[0];
  const econ = useMemo(
    () => (product ? analyzeFlexiblePack(product, state.assumptions) : null),
    [product, state.assumptions]
  );

  const safeSales = useMemo(() => {
    if (!product || !econ) return null;
    return estimateSafePackSales({
      product,
      assumptions: state.assumptions,
      additionalPacksToSell: safeSalesCount,
      currentOutstandingCredits: model.accessProducts.creditHealth.creditsOutstanding,
      eligibleFlexibleCapacitySessions:
        model.accessProducts.creditHealth.eligibleFlexibleCapacity,
      eligiblePeakFlexibleCapacitySessions:
        model.accessProducts.creditHealth.eligiblePeakFlexibleCapacity,
    });
  }, [product, econ, safeSalesCount, state.assumptions, model]);

  if (!product || !econ) {
    return (
      <div>
        <SectionHeader title="Pack Designer" description="No flexible packs configured." />
      </div>
    );
  }

  const rules = product.packRules!;

  return (
    <div>
      <SectionHeader
        title="Pack Designer"
        description="Pack economics for founder planning — net prices ex-GST, customer pays calculated automatically."
      />
      <SampleBanner />
      <p className="mb-4 text-sm text-[#6B6560]">
        Edit packs on{" "}
        <Link href="/math/access-products/flexible" className="underline">
          Flexible Credits
        </Link>
        .
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {packs.map((p) => (
          <Button
            key={p.id}
            variant={p.id === selectedId ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedId(p.id)}
          >
            {p.name}
          </Button>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{product.name.toUpperCase()}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <Section label="Product">
            <SummaryRow label="Credits" value={String(econ.credits)} />
            <SummaryRow label="Validity" value={`${rules.validityValue} weeks`} />
          </Section>

          <Section label="Pricing">
            <SummaryRow label="Net pack price" value={formatINR(econ.netPackageValue)} />
            <SummaryRow label="Net price / credit sold" value={formatINR(econ.netPerCredit)} />
            <SummaryRow label="Customer pays incl. GST" value={formatINR(econ.grossPrice)} />
          </Section>

          <Section label="Expected usage">
            <SummaryRow
              label="Expected credits used"
              value={`${econ.expectedCreditsRedeemed.toFixed(1)} / ${econ.credits}`}
            />
            <SummaryRow label="Expected unused" value={econ.expectedCreditsUnused.toFixed(1)} />
            <SummaryRow
              label="Expected capacity consumed"
              value={`${econ.expectedReformerSessions.toFixed(1)} spots`}
            />
          </Section>

          <Section label="Economics">
            <SummaryRow label="Net sales" value={formatINR(econ.netPackageValue)} />
            <SummaryRow label="Expected delivery cost" value={formatINR(econ.expectedVariableCost)} />
            <SummaryRow label="Expected contribution" value={formatINR(econ.expectedContribution)} />
            <SummaryRow label="Contribution margin" value={formatPercent(econ.contributionMarginPct)} />
          </Section>

          <button
            type="button"
            className="text-xs text-[#6B6560] underline"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? "Hide" : "Show"} redemption assumptions
          </button>
          {showAdvanced && (
            <div className="space-y-2 rounded-lg bg-[#FAF8F5] p-3">
              <SummaryRow
                label="Expected redemption %"
                value={String(rules.expectedRedemptionRatePct)}
              />
              <SummaryRow
                label="Expected breakage %"
                value={String(rules.expectedBreakageRatePct)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Safe pack sales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span>Additional packs to test:</span>
            <Input
              type="number"
              className="w-24"
              value={safeSalesCount}
              onChange={(e) => setSafeSalesCount(Number(e.target.value))}
            />
          </div>
          {safeSales && (
            <>
              <SummaryRow
                label="Current outstanding credits"
                value={safeSales.currentOutstandingCredits.toFixed(0)}
              />
              <SummaryRow
                label="Expected redemptions (current)"
                value={safeSales.currentExpectedRedemptions.toFixed(1)}
              />
              <SummaryRow
                label="Eligible capacity in validity window"
                value={`${safeSales.eligibleCapacityDuringValidity.toFixed(0)} spots`}
              />
              <SummaryRow
                label="Expected capacity headroom (now)"
                value={`${safeSales.currentCapacityHeadroom.toFixed(0)} spots`}
              />
              <SummaryRow
                label="Credits added"
                value={safeSales.creditsAdded.toFixed(0)}
              />
              <SummaryRow
                label="Expected additional redemptions"
                value={safeSales.expectedAdditionalRedemptions.toFixed(1)}
              />
              <SummaryRow
                label="Headroom after sale"
                value={`${safeSales.headroomAfterSale.toFixed(0)} spots`}
              />
              <SummaryRow
                label="Coverage ratio"
                value={`${safeSales.capacityCoverageRatio.toFixed(2)}×`}
              />
              <p className="font-medium text-[#2C2825]">
                Status: {STATUS_LABEL[safeSales.status] ?? safeSales.status}
              </p>
              <p className="text-xs text-[#6B6560]">{safeSales.plainEnglishSummary}</p>
              <p className="text-xs text-[#A39E98]">{safeSales.formulaNotes}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase text-[#A39E98]">{label}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[#6B6560]">{label}</span>
      <span className="font-medium text-[#2C2825]">{value}</span>
    </div>
  );
}
