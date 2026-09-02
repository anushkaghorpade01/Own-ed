"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/store/app-store";
import { useFinanceModel } from "@/hooks/use-finance-model";
import { calculateAccessProducts } from "@/lib/finance/engine/access-products";
import { SectionHeader, SampleBanner } from "@/components/shared/metric-card";
import { ServiceDemandMixCard } from "@/components/finance/service-demand-mix-card";
import { formatINR } from "@/lib/format/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import type {
  AccessProductAnalysis,
  StandingSpotAccessAnalysis,
  ThreeTypesPredictability,
} from "@/lib/finance/engine/access-products";
import Decimal from "decimal.js";

function PredictabilityCard({ p }: { p: ThreeTypesPredictability }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3 text-sm">
      <div className="rounded-lg bg-white p-3 border border-[#E8E2D9]">
        <p className="text-xs font-medium text-[#A39E98]">Cash certainty</p>
        <Badge variant="outline" className="mt-1 capitalize">{p.cashCertainty}</Badge>
        <p className="mt-2 text-xs text-[#6B6560]">{p.cashCertaintyNote}</p>
      </div>
      <div className="rounded-lg bg-white p-3 border border-[#E8E2D9]">
        <p className="text-xs font-medium text-[#A39E98]">Class occupancy certainty</p>
        <Badge variant="outline" className="mt-1 capitalize">{p.classOccupancyCertainty}</Badge>
        <p className="mt-2 text-xs text-[#6B6560]">{p.classOccupancyCertaintyNote}</p>
      </div>
      <div className="rounded-lg bg-white p-3 border border-[#E8E2D9]">
        <p className="text-xs font-medium text-[#A39E98]">Future-period revenue visibility</p>
        <Badge variant="outline" className="mt-1 capitalize">{p.futurePeriodRevenueVisibility}</Badge>
        <p className="mt-2 text-xs text-[#6B6560]">{p.futurePeriodRevenueVisibilityNote}</p>
      </div>
    </div>
  );
}

function ProductSection({ product }: { product: AccessProductAnalysis }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{product.name}</CardTitle>
          <Badge variant="secondary">{product.kind.replace(/_/g, " ")}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        <PredictabilityCard p={product.predictability} />

        <div className="grid gap-4 lg:grid-cols-2">
          <SectionBlock title="How it works" text={product.narrative.howItWorks} />
          <SectionBlock title="Why this product might exist" text={product.narrative.whyThisProductMightExist} />
          <SectionBlock title="What the customer gets" text={product.narrative.whatCustomerGets} />
          <SectionBlock title="What OWN gets" text={product.narrative.whatOwnGets} />
          <SectionBlock title="What OWN gives up" text={product.narrative.whatOwnGivesUp} />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#A39E98]">Risks</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[#6B6560]">
              {product.narrative.risks.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <MetricGrid title="Financial inputs" data={product.financialInputs} />
          <MetricGrid
            title="Financial outputs"
            data={Object.fromEntries(
              Object.entries(product.financialOutputs).map(([k, v]) => [
                k,
                v instanceof Decimal ? formatINR(v) : String(v),
              ])
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SectionBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-[#A39E98]">{title}</p>
      <p className="mt-1 text-[#6B6560]">{text}</p>
    </div>
  );
}

function MetricGrid({
  title,
  data,
}: {
  title: string;
  data: Record<string, string | number | boolean>;
}) {
  return (
    <div className="rounded-lg bg-[#FAF8F5] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[#A39E98]">{title}</p>
      <dl className="mt-2 space-y-1">
        {Object.entries(data).map(([key, val]) => (
          <div key={key} className="flex justify-between gap-4">
            <dt className="text-[#A39E98]">{humanize(key)}</dt>
            <dd className="text-right text-[#2C2825]">{String(val)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function humanize(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/Pct/g, " %")
    .replace(/^./, (s) => s.toUpperCase());
}

function StandingSpotSection({
  standingSpot,
  customPremium,
  onPremiumChange,
}: {
  standingSpot: StandingSpotAccessAnalysis;
  customPremium: number;
  onPremiumChange: (v: number) => void;
}) {
  const { sensitivity } = standingSpot;

  return (
    <div className="space-y-6">
      <ProductSection product={standingSpot} />

      <Card>
        <CardHeader>
          <CardTitle>Capacity reservation value</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-[#6B6560]">
          <p>
            Expected Standing Spot contribution minus expected flexible contribution from the same
            reserved capacity. Positive means Standing Spot improves expected contribution; negative
            suggests the reserved seat may be priced too cheaply relative to expected flexible demand.
            Uses expected fill probability — not assumed 100% flexible sales.
          </p>
          <p className="text-lg font-serif text-[#2C2825]">
            Current reservation value:{" "}
            {formatINR(standingSpot.financialOutputs.capacityReservationValue)}/month
          </p>
          <p>
            Economic neutral gross monthly price:{" "}
            <strong>{formatINR(standingSpot.economicNeutralGrossMonthlyPrice)}</strong>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Standing Spot premium scenarios</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-[#6B6560]">
            Standing Spot may justify a premium because certainty has value — but a longer commitment
            may alternatively justify equal or lower pricing. The model informs the decision; it does
            not hardcode a premium.
          </p>
          <div className="mb-4 flex items-center gap-2">
            <label className="text-xs text-[#A39E98]">Custom premium %</label>
            <Input
              type="number"
              className="w-24"
              value={customPremium}
              onChange={(e) => onPremiumChange(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E2D9] text-left text-xs text-[#A39E98]">
                  <th className="py-2 pr-4">Premium</th>
                  <th className="py-2 pr-4">Net / session</th>
                  <th className="py-2 pr-4">SS contribution</th>
                  <th className="py-2 pr-4">Expected flex contribution</th>
                  <th className="py-2">Reservation value</th>
                </tr>
              </thead>
              <tbody>
                {standingSpot.premiumScenarios.map((s) => (
                  <tr key={s.premiumPct} className="border-b border-[#F0EBE3]">
                    <td className="py-2 pr-4 font-medium">{s.label}</td>
                    <td className="py-2 pr-4">{formatINR(s.netRevenuePerSession)}</td>
                    <td className="py-2 pr-4">{formatINR(s.standingSpotContribution)}</td>
                    <td className="py-2 pr-4">{formatINR(s.expectedFlexibleContribution)}</td>
                    <td
                      className={`py-2 font-medium ${
                        s.capacityReservationValue.gte(0) ? "text-[#2C2825]" : "text-[#8B3A3A]"
                      }`}
                    >
                      {formatINR(s.capacityReservationValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sensitivity — fill probability × premium</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <p className="mb-3 text-xs text-[#6B6560]">
            Cell = capacity reservation value (monthly contribution difference). At what demand level
            does reserving the seat require a premium?
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="py-2 pr-2 text-left text-[#A39E98]">Fill ↓ / Premium →</th>
                {sensitivity.premiumPcts.map((p) => (
                  <th key={p} className="px-2 py-2 text-right text-[#A39E98]">
                    {p}%
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sensitivity.fillProbabilities.map((fill, ri) => (
                <tr key={fill} className="border-t border-[#F0EBE3]">
                  <td className="py-2 pr-2 font-medium">{fill}%</td>
                  {sensitivity.cells[ri].map((cell, ci) => (
                    <td
                      key={ci}
                      className={`px-2 py-2 text-right ${
                        cell.gte(0) ? "text-[#2C2825]" : "text-[#8B3A3A]"
                      }`}
                    >
                      {formatINR(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AccessProductsPage() {
  const { state, updateAssumptions } = useApp();
  const [customPremium, setCustomPremium] = useState(0);
  const model = useFinanceModel();
  const ap = useMemo(
    () =>
      calculateAccessProducts(
        state.assumptions,
        model.capacity,
        customPremium
      ),
    [state.assumptions, model.capacity, customPremium]
  );

  const standingSpot = ap.standingSpot;
  const standby = ap.standby;
  const otherProducts = ap.products.filter(
    (p) => p.kind !== "standing_spot" && p.kind !== "standby"
  );

  return (
    <div>
      <SectionHeader
        title="Access Products"
        description="Economics of how customers access OWN — each product trades flexibility, certainty, commitment, and inventory differently."
      />
      <SampleBanner />

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <PhilosophyCard
          title="Flexible"
          tagline="Choose when you come."
          body="Prepaid credit packs — quantity + validity. Net sales at purchase; redemption affects delivery costs and capacity."
        />
        <PhilosophyCard
          title="Standing"
          tagline="Know when you come."
          body="Recurring reserved reformer capacity on specific class slots. Schedule certainty, not flexible credits."
        />
        <PhilosophyCard
          title="Standby"
          tagline="Come when there's room."
          body="Discounted access to genuinely unused last-minute capacity. OWN controls timing."
        />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Access product principle</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[#6B6560]">
          <p>
            These are not merely different prices. Each product exchanges different combinations of
            customer flexibility, timing certainty, commitment, capacity reservation, price, future
            revenue visibility, and inventory risk.
          </p>
          <p className="mt-3">
            Do not use “predictability” generically. Distinguish{" "}
            <strong>cash certainty</strong> (has the customer already paid?),{" "}
            <strong>class occupancy certainty</strong> (do we know which future classes this demand
            belongs to?), and <strong>future-period revenue visibility</strong> (is the customer
            contractually committed to future months?).
          </p>
        </CardContent>
      </Card>

      <ServiceDemandMixCard />

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Optional products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-[#6B6560]">
            <p>
              Standing Spot and Standby are modelled separately from the 100% service demand mix.
            </p>
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
                onChange={(e) =>
                  updateAssumptions({ privateRequiresExclusiveStudio: e.target.checked })
                }
              />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Private economics</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[#6B6560]">
            <p className="mb-3">
              Private sessions have separate price, duration, and contribution economics — not the
              same as one redeemed group credit.
            </p>
            <Link
              href="/math/access-products/mix"
              className="text-[#2C2825] underline underline-offset-2"
            >
              Open service demand mix &amp; private pricing →
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Product comparison</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-xs">
            <thead>
              <tr className="border-b border-[#E8E2D9] text-left text-[#A39E98]">
                <th className="py-2 pr-4">Dimension</th>
                <th className="px-2 py-2">Drop-in</th>
                <th className="px-2 py-2">Flexible pack</th>
                <th className="px-2 py-2">Standing Spot</th>
                <th className="px-2 py-2">Standby</th>
                <th className="px-2 py-2">Private</th>
                <th className="px-2 py-2">Duo</th>
              </tr>
            </thead>
            <tbody>
              {ap.productComparison.map((row) => (
                <tr key={row.label} className="border-b border-[#F0EBE3]">
                  <td className="py-2 pr-4 font-medium text-[#2C2825]">{row.label}</td>
                  <td className="px-2 py-2 text-[#6B6560]">{row.dropIn}</td>
                  <td className="px-2 py-2 text-[#6B6560]">{row.flexiblePack}</td>
                  <td className="px-2 py-2 text-[#6B6560]">{row.standingSpot}</td>
                  <td className="px-2 py-2 text-[#6B6560]">{row.standby}</td>
                  <td className="px-2 py-2 text-[#6B6560]">{row.private}</td>
                  <td className="px-2 py-2 text-[#6B6560]">{row.duo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="space-y-8">
        <h2 className="font-serif text-xl text-[#2C2825]">Product economics</h2>

        {otherProducts.map((p) => (
          <ProductSection key={p.id} product={p} />
        ))}

        {standingSpot && (
          <StandingSpotSection
            standingSpot={standingSpot}
            customPremium={customPremium}
            onPremiumChange={setCustomPremium}
          />
        )}

        {standby && (
          <>
            <ProductSection product={standby} />
            <Card>
              <CardHeader>
                <CardTitle>Break-even cannibalisation rate</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-[#6B6560]">
                <p className="text-lg font-serif text-[#2C2825]">
                  {standby.breakEvenCannibalisationPct.toFixed(0)}%
                </p>
                <p className="mt-2">{standby.breakEvenExplanation}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function PhilosophyCard({
  title,
  tagline,
  body,
}: {
  title: string;
  tagline: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-[#E8E2D9] bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[#A39E98]">{title}</p>
      <p className="mt-1 font-serif text-lg text-[#2C2825]">{tagline}</p>
      <p className="mt-2 text-sm text-[#6B6560]">{body}</p>
    </div>
  );
}
