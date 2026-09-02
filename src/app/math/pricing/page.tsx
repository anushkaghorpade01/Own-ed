"use client";

import { useApp } from "@/lib/store/app-store";
import {
  productNetPrice,
  productNetRevenuePerCredit,
  productGrossPrice,
  analyzeStandingSpotReservations,
  stripGst,
} from "@/lib/finance/engine/revenue";
import { useFinanceModel } from "@/hooks/use-finance-model";
import { SectionHeader, SampleBanner, BusinessInsightCard } from "@/components/shared/metric-card";
import { ModelUpdatingIndicator } from "@/components/finance/model-updating-indicator";
import {
  explainGstMode,
  explainWeightedRevenue,
  explainStandingSpotReservation,
} from "@/lib/finance/business-insights";
import { STANDING_SPOT_EXPLAINER } from "@/lib/finance/engine/standing-spots";
import { formatINR } from "@/lib/format/currency";
import { PRICING_VERSIONING_NOTE } from "@/lib/finance/cash-basis";
import { Input } from "@/components/ui/input";
import { DebouncedNumberInput, DebouncedTextInput } from "@/components/ui/debounced-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { d } from "@/lib/finance/decimal";

const DAY_OPTIONS = [
  { value: "mon", label: "Monday" },
  { value: "tue", label: "Tuesday" },
  { value: "wed", label: "Wednesday" },
  { value: "thu", label: "Thursday" },
  { value: "fri", label: "Friday" },
  { value: "sat", label: "Saturday" },
  { value: "sun", label: "Sunday" },
] as const;

export default function PricingPage() {
  const { state, updateAssumptions } = useApp();
  const model = useFinanceModel();
  const a = state.assumptions;
  const standingSpots = analyzeStandingSpotReservations(
    a,
    model.capacity.monthlyAvailableSeats
  );
  const standingSpotInsight = explainStandingSpotReservation(standingSpots);
  const gstInsight = explainGstMode("exclusive", a.gstRatePct, a.products[0]?.price ?? 1695);
  const revenueInsight = explainWeightedRevenue(model);

  const updateProduct = (id: string, field: string, value: number | boolean | string) => {
    updateAssumptions({
      products: a.products.map((p) =>
        p.id === id ? { ...p, [field]: value } : p
      ),
    });
  };

  const mixTotal = 100; // Service demand mix edited on Access Products → Mix

  return (
    <div>
      <SectionHeader
        title="Pricing"
        description="Enter net sales prices ex-GST. Customer pays is calculated automatically (net × 1 + GST rate)."
        action={<ModelUpdatingIndicator />}
      />
      <SampleBanner />

      <div className="mb-6 rounded-lg border border-[#E8E2D9] bg-[#FAF8F5] px-4 py-3 text-sm text-[#6B6560]">
        {PRICING_VERSIONING_NOTE}{" "}
        <a href="/math/access-products/flexible" className="underline">
          Flexible Credits
        </a>
        ,{" "}
        <a href="/math/access-products/standing" className="underline">
          Standing
        </a>
        , or{" "}
        <a href="/math/access-products/standby" className="underline">
          Standby
        </a>
        .
      </div>

      <div className="mb-6 space-y-4">
        <BusinessInsightCard {...gstInsight} />
        <BusinessInsightCard {...revenueInsight} />
        {standingSpots.length > 0 && <BusinessInsightCard {...standingSpotInsight} />}
      </div>

      <div className="mb-6 rounded-lg border border-[#E8E2D9] bg-[#FAF8F5] px-4 py-3 text-sm text-[#6B6560]">
        Service booking mix (Drop-In, packs, Private) is edited on{" "}
        <a href="/math/access-products/mix" className="underline">
          Access Products → Mix
        </a>
        . This page is for net prices only.
      </div>

      <div className="space-y-4">
        {a.products.map((product) => {
          const netPrice = productNetPrice(product, a);
          const grossPrice = productGrossPrice(product, a);
          const netPerCredit = productNetRevenuePerCredit(product, a);
          const isStandingSpot = product.type === "standing_spot";

          return (
            <Card key={product.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{product.name}</CardTitle>
                  <Badge variant="outline" className="mt-1">{product.type.replace(/_/g, " ")}</Badge>
                </div>
                {product.type === "private" && (
                  <Badge variant="secondary">Core service — mix on Access Products</Badge>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="text-xs text-[#A39E98]">
                      {isStandingSpot ? "Net price / month (excl. GST) ₹" : "Net price (excl. GST) ₹"}
                    </label>
                    <DebouncedNumberInput
                      value={product.price}
                      onCommit={(v) => updateProduct(product.id, "price", v)}
                    />
                  </div>
                  {!isStandingSpot && product.type !== "private" && (
                    <div>
                      <p className="text-xs text-[#A39E98]">Net sales / occupied booking</p>
                      <p className="text-kpi-secondary">{formatINR(netPerCredit)}</p>
                    </div>
                  )}
                  {product.type === "private" && (
                    <div>
                      <p className="text-xs text-[#A39E98]">Net sales / session</p>
                      <p className="text-kpi-secondary">{formatINR(netPrice)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-[#A39E98]">Customer pays incl. GST</p>
                    <p className="text-kpi-secondary">{formatINR(grossPrice)}</p>
                  </div>
                </div>

                {isStandingSpot && (
                  <div className="mt-4 rounded-lg border border-[#E8E2D9] bg-[#FAF8F5] p-4">
                    <p className="text-sm text-[#6B6560]">{STANDING_SPOT_EXPLAINER}</p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={product.standingSpotRecurringSubscription ?? product.recurring}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            updateAssumptions({
                              products: a.products.map((p) =>
                                p.id === product.id
                                  ? {
                                      ...p,
                                      standingSpotRecurringSubscription: checked,
                                      recurring: checked,
                                    }
                                  : p
                              ),
                            });
                          }}
                          id={`ss-recurring-${product.id}`}
                        />
                        <label htmlFor={`ss-recurring-${product.id}`} className="text-xs text-[#6B6560]">
                          Recurring subscription
                        </label>
                      </div>
                      <div>
                        <label className="text-xs text-[#A39E98]">Minimum commitment (months)</label>
                        <DebouncedNumberInput
                          value={product.standingSpotMinCommitmentMonths ?? 0}
                          onCommit={(v) =>
                            updateProduct(product.id, "standingSpotMinCommitmentMonths", Math.round(v))
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[#A39E98]">Classes per month</label>
                        <DebouncedNumberInput
                          value={product.standingSpotClassesPerMonth ?? 0}
                          onCommit={(v) => updateProduct(product.id, "standingSpotClassesPerMonth", v)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[#A39E98]">Reserved day</label>
                        <select
                          className="w-full rounded-md border border-[#E8E2D9] bg-white px-3 py-2 text-sm"
                          value={product.standingSpotReservedDay ?? ""}
                          onChange={(e) => updateProduct(product.id, "standingSpotReservedDay", e.target.value)}
                        >
                          <option value="">Select day</option>
                          {DAY_OPTIONS.map((d) => (
                            <option key={d.value} value={d.value}>{d.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-[#A39E98]">Reserved time</label>
                        <Input
                          type="time"
                          value={product.standingSpotReservedTime ?? ""}
                          onChange={(e) => updateProduct(product.id, "standingSpotReservedTime", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[#A39E98]">Reserved reformers per class</label>
                        <DebouncedNumberInput
                          value={product.standingSpotSeatsPerClass ?? 1}
                          onCommit={(v) =>
                            updateProduct(product.id, "standingSpotSeatsPerClass", Math.round(v))
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[#A39E98]">Cancellation policy</label>
                        <Input
                          value={product.standingSpotCancellationPolicy ?? ""}
                          onChange={(e) => updateProduct(product.id, "standingSpotCancellationPolicy", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[#A39E98]">Pause policy</label>
                        <Input
                          value={product.standingSpotPausePolicy ?? ""}
                          onChange={(e) => updateProduct(product.id, "standingSpotPausePolicy", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[#A39E98]">Missed-class policy</label>
                        <Input
                          value={product.standingSpotMissedClassPolicy ?? ""}
                          onChange={(e) => updateProduct(product.id, "standingSpotMissedClassPolicy", e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={product.standingSpotMakeUpEligible ?? false}
                          onChange={(e) => updateProduct(product.id, "standingSpotMakeUpEligible", e.target.checked)}
                          id={`ss-makeup-${product.id}`}
                        />
                        <label htmlFor={`ss-makeup-${product.id}`} className="text-xs text-[#6B6560]">
                          Make-up class eligible
                        </label>
                      </div>
                    </div>
                  </div>
                )}


              </CardContent>
            </Card>
          );
        })}
      </div>

      {standingSpots.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Standing Spot — capacity reservation analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-[#6B6560]">{STANDING_SPOT_EXPLAINER}</p>
            {standingSpots.map((ss) => (
              <div key={ss.product.id} className="rounded-lg bg-[#FAF8F5] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{ss.product.name}</p>
                  {ss.reservedDay && ss.reservedTime && (
                    <Badge variant="outline">
                      {ss.reservedDay.toUpperCase()} {ss.reservedTime}
                    </Badge>
                  )}
                  {ss.isRecurringSubscription && (
                    <Badge variant="secondary">Recurring</Badge>
                  )}
                  {ss.minCommitmentMonths > 0 && (
                    <Badge variant="secondary">{ss.minCommitmentMonths}mo min</Badge>
                  )}
                </div>

                <p className="mt-2 text-sm text-[#6B6560]">
                  Reserves {ss.committedSeatsPerClass.toFixed(0)} reformer(s) per class ({ss.committedOccupancyBeforeFlexiblePct.toFixed(0)}% committed occupancy before flexible bookings). {ss.remainingFlexibleSeatsPerClass.toFixed(0)} flexible spot(s) remain per reserved class.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                  <div>
                    <p className="text-xs text-[#A39E98]">Committed monthly revenue</p>
                    <p className="font-medium">{formatINR(ss.committedMonthlyRevenue)}/mo</p>
                    <p className="text-[10px] text-[#A39E98]">Earned/planned net revenue for reserved classes this month</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#A39E98]">Monthly contracted cash</p>
                    <p className="font-medium">{formatINR(ss.monthlyContractedCash)}/mo</p>
                    <p className="text-[10px] text-[#A39E98]">Cash collected this month (recurring billing). Differs from prepaid pack cash timing.</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#A39E98]">Contracted future revenue</p>
                    <p className="font-medium">
                      {ss.futureContractedRevenue != null
                        ? `${formatINR(ss.futureContractedRevenue)} remaining`
                        : ss.hasFutureRevenueVisibility
                          ? "Open-ended recurring — no fixed total"
                          : "N/A — no commitment term"}
                    </p>
                    <p className="text-[10px] text-[#A39E98]">Only where a genuine subscription or minimum commitment exists</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#A39E98]">Effective net revenue per reserved class</p>
                    <p className="font-medium">{formatINR(ss.effectiveNetRevenuePerReservedClass)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#A39E98]">Premium / discount vs credit pack</p>
                    <p className={`font-medium ${ss.premiumDiscountVsCreditPack.gte(0) ? "text-[#2C2825]" : "text-[#8B3A3A]"}`}>
                      {ss.premiumDiscountVsCreditPack.gte(0) ? "+" : ""}
                      {formatINR(ss.premiumDiscountVsCreditPack)} ({ss.premiumDiscountPct.toFixed(0)}%)
                    </p>
                    <p className="text-[10px] text-[#A39E98]">vs {formatINR(ss.comparableCreditPackNetPerClass)} weighted credit pack per class</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#A39E98]">Flexible inventory sacrificed</p>
                    <p className="font-medium">{ss.flexibleInventorySacrificed.toFixed(0)} seat-reservations/mo</p>
                    <p className="text-[10px] text-[#A39E98]">{ss.remainingFlexibleInventoryStudioWide.toFixed(0)} flexible seats remain studio-wide</p>
                  </div>
                </div>

                {(ss.cancellationPolicy || ss.pausePolicy || ss.missedClassPolicy) && (
                  <div className="mt-3 text-xs text-[#6B6560]">
                    {ss.cancellationPolicy && <p>Cancellation: {ss.cancellationPolicy}</p>}
                    {ss.pausePolicy && <p>Pause: {ss.pausePolicy}</p>}
                    {ss.missedClassPolicy && <p>Missed class: {ss.missedClassPolicy}</p>}
                    {ss.makeUpEligible && <p>Make-up classes eligible</p>}
                  </div>
                )}

                <p className="mt-3 text-xs text-[#A39E98] italic">{ss.revenuePredictabilityNote}</p>

                {ss.capacityWarning && (
                  <p className="mt-2 text-xs text-[#8B3A3A]">{ss.capacityWarning}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
