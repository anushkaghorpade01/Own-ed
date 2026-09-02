"use client";

import { useFinanceModel } from "@/hooks/use-finance-model";
import { SectionHeader, SampleBanner } from "@/components/shared/metric-card";
import { formatINR } from "@/lib/format/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function CreditHealthPage() {
  const model = useFinanceModel();
  const health = model.accessProducts.creditHealth;
  const ledger = model.accessProducts.creditLedger;

  return (
    <div>
      <SectionHeader
        title="Credit Health"
        description="Outstanding credits are normal for prepaid packs. Risk appears when expected obligations approach eligible flexible capacity — especially at peak times."
      />
      <SampleBanner />

      <p className="mb-6 text-sm text-[#6B6560]">{health.plainEnglishSummary}</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Credits sold (modelled)" value={health.creditsSold.toFixed(0)} />
        <Metric label="Credits redeemed" value={health.creditsRedeemed.toFixed(0)} />
        <Metric label="Credits outstanding" value={health.creditsOutstanding.toFixed(0)} />
        <Metric label="Expiring (modelled)" value={health.creditsNearingExpiry.toFixed(0)} />
        <Metric label="Redemptions next 2 wks" value={health.expectedRedemptionsNext2Weeks.toFixed(1)} />
        <Metric label="Redemptions next 4 wks" value={health.expectedRedemptionsNext4Weeks.toFixed(1)} />
        <Metric label="Eligible flexible capacity" value={health.eligibleFlexibleCapacity.toFixed(0)} />
        <Metric label="Eligible peak flexible" value={health.eligiblePeakFlexibleCapacity.toFixed(0)} />
        <Metric label="Overall redemption coverage" value={`${health.overallRedemptionCoverage.toFixed(2)}×`} />
        <Metric label="Peak redemption coverage" value={`${health.peakRedemptionCoverage.toFixed(2)}×`} />
      </div>

      {health.warnings.length > 0 && (
        <div className="mt-6 space-y-3">
          {health.warnings.map((w) => (
            <div
              key={w.code}
              className="rounded-lg border border-[#E8E2D9] bg-white px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <Badge variant={w.severity === "pressure" ? "danger" : "secondary"}>
                  {w.severity}
                </Badge>
                <span className="font-medium text-sm">{w.title}</span>
              </div>
              <p className="mt-2 text-sm text-[#6B6560]">{w.message}</p>
            </div>
          ))}
        </div>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Credit ledger</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-[#6B6560]">{ledger.plainEnglishSummary}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-[#A39E98]">
                  <th className="pb-2 pr-4">Cohort</th>
                  <th className="pb-2 pr-4">Purchased</th>
                  <th className="pb-2 pr-4">Redeemed</th>
                  <th className="pb-2 pr-4">Expired</th>
                  <th className="pb-2">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {ledger.cohorts.map((c) => (
                  <tr key={c.productId} className="border-b border-[#F0EBE3]">
                    <td className="py-2 pr-4">{c.productName}</td>
                    <td className="py-2 pr-4">{c.creditsPurchased.toFixed(0)}</td>
                    <td className="py-2 pr-4">{c.creditsRedeemed.toFixed(1)}</td>
                    <td className="py-2 pr-4">{c.creditsExpired.toFixed(1)}</td>
                    <td className="py-2">{c.creditsRemaining.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>What outstanding credits mean</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[#6B6560] space-y-2">
          <p>
            These are classes customers have already paid for but have not yet used or legitimately forfeited/expired.
            They represent future classes OWN may still need to provide.
          </p>
          <p>
            Validity is how long a customer has to use their credits. Longer validity gives the customer more flexibility
            but keeps OWN&apos;s future service obligation open for longer.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E8E2D9] bg-white p-4">
      <p className="text-xs text-[#A39E98]">{label}</p>
      <p className="mt-1 text-lg font-medium text-[#2C2825]">{value}</p>
    </div>
  );
}
