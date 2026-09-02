"use client";

import { useState } from "react";
import type { Product, FlexiblePackRules, StandingSpotRules } from "@/lib/finance/schemas";
import { resolvePackRules } from "@/lib/finance/engine/flexible-packs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface ProductEditorModalProps {
  product: Product;
  onClose: () => void;
  onSave: (product: Product, asDraft: boolean) => void;
  onPreview?: (product: Product) => void;
}

export function ProductEditorModal({
  product,
  onClose,
  onSave,
  onPreview,
}: ProductEditorModalProps) {
  const [draft, setDraft] = useState<Product>(structuredClone(product));
  const [showRules, setShowRules] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const rules = resolvePackRules(draft);
  const standingRules: StandingSpotRules = draft.standingSpotRules ?? {
    recurringSlots: [],
    commitmentMonthsOffered: [1, 2],
    defaultCommitmentMonths: 1,
    premiumPct: 0,
    releasePolicy: "makeup_if_released_before_window",
    releaseProbabilityPct: 10,
    resaleProbabilityPct: 50,
  };

  function patch(partial: Partial<Product>) {
    setDraft((d) => ({ ...d, ...partial }));
  }

  function patchRules(partial: Partial<FlexiblePackRules>) {
    setDraft((d) => ({
      ...d,
      packRules: { ...resolvePackRules(d), ...partial },
    }));
  }

  function patchStandingRules(partial: Partial<StandingSpotRules>) {
    setDraft((d) => ({
      ...d,
      standingSpotRules: { ...standingRules, ...partial },
    }));
  }

  const isFlexible = draft.type === "credit_pack" || draft.type === "drop_in";
  const isStanding = draft.type === "standing_spot";
  const isStandby = draft.type === "standby";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/20 pt-[8vh] backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-xl border border-[#E8E2D9] bg-[#FAF8F5] p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl text-[#2C2825]">Edit product</h2>
            <p className="text-xs text-[#A39E98]">
              ID: {draft.id} · v{draft.versionNumber ?? 1}
            </p>
          </div>
          <Badge variant="outline">{draft.lifecycle ?? "active"}</Badge>
        </div>

        <div className="space-y-4 text-sm">
          <Field label="Product name" value={draft.name} onChange={(v) => patch({ name: v })} />

          {isFlexible && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Credits" type="number" value={String(draft.creditsIncluded)} onChange={(v) => patch({ creditsIncluded: Number(v) })} />
                <Field label="Net price excl. GST (₹)" type="number" value={String(draft.price)} onChange={(v) => patch({ price: Number(v) })} />
                <Field label="Validity (weeks)" type="number" value={String(rules.validityValue)} onChange={(v) => patchRules({ validityValue: Number(v) })} />
                <Field label="Activation deadline (days)" type="number" value={String(rules.activationDeadlineDays)} onChange={(v) => patchRules({ activationDeadlineDays: Number(v) })} />
                <Field label="Package mix %" type="number" value={String(draft.packageMixPct)} onChange={(v) => patch({ packageMixPct: Number(v) })} />
                <TaxSelect draft={draft} patch={patch} />
              </div>

              <button type="button" className="text-xs text-[#6B6560] underline" onClick={() => setShowRules(!showRules)}>
                {showRules ? "Hide" : "Show"} customer rules
              </button>
              {showRules && (
                <div className="grid gap-3 rounded-lg bg-white p-4 sm:grid-cols-2">
                  <Field label="Booking window (hours)" type="number" value={String(rules.bookingWindowHours ?? "")} onChange={(v) => patchRules({ bookingWindowHours: Number(v) || undefined })} />
                  <Field label="Cancellation window (hours)" type="number" value={String(rules.cancellationWindowHours ?? "")} onChange={(v) => patchRules({ cancellationWindowHours: Number(v) || undefined })} />
                  <Field label="Late cancellation rule" value={rules.lateCancelPolicy ?? ""} onChange={(v) => patchRules({ lateCancelPolicy: v })} />
                  <Field label="No-show rule" value={rules.noShowPolicy ?? ""} onChange={(v) => patchRules({ noShowPolicy: v })} />
                  <Field label="Rollover policy" value={rules.rolloverPolicy ?? ""} onChange={(v) => patchRules({ rolloverPolicy: v })} />
                  <Field label="Freeze policy" value={rules.freezePolicy ?? ""} onChange={(v) => patchRules({ freezePolicy: v })} />
                  <Field label="Extension policy" value={rules.extensionPolicy ?? ""} onChange={(v) => patchRules({ extensionPolicy: v })} />
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={rules.refundable} onChange={(e) => patchRules({ refundable: e.target.checked })} />
                    Refundable
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={rules.transferable} onChange={(e) => patchRules({ transferable: e.target.checked })} />
                    Transferable
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={draft.peakEligible} onChange={(e) => patch({ peakEligible: e.target.checked })} />
                    Peak eligible
                  </label>
                </div>
              )}

              <button type="button" className="text-xs text-[#6B6560] underline" onClick={() => setShowAdvanced(!showAdvanced)}>
                {showAdvanced ? "Hide" : "Show"} financial assumptions
              </button>
              {showAdvanced && (
                <div className="grid gap-3 rounded-lg bg-white p-4 sm:grid-cols-2">
                  <Field label="Expected redemption %" type="number" value={String(rules.expectedRedemptionRatePct)} onChange={(v) => patchRules({ expectedRedemptionRatePct: Number(v) })} />
                  <Field label="Expected breakage %" type="number" value={String(rules.expectedBreakageRatePct)} onChange={(v) => patchRules({ expectedBreakageRatePct: Number(v) })} />
                  <Field label="Expected cancellation %" type="number" value={String(rules.expectedCancellationRatePct)} onChange={(v) => patchRules({ expectedCancellationRatePct: Number(v) })} />
                  <Field label="Expected no-show %" type="number" value={String(rules.expectedNoShowRatePct)} onChange={(v) => patchRules({ expectedNoShowRatePct: Number(v) })} />
                  <Field label="Peak booking share %" type="number" value={String(rules.expectedPeakBookingSharePct)} onChange={(v) => patchRules({ expectedPeakBookingSharePct: Number(v) })} />
                  <Field label="Sales volume / month" type="number" value={String(rules.expectedSalesVolumePerMonth)} onChange={(v) => patchRules({ expectedSalesVolumePerMonth: Number(v) })} />
                </div>
              )}
            </>
          )}

          {isStanding && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Gross price / month (₹)" type="number" value={String(draft.price)} onChange={(v) => patch({ price: Number(v) })} />
                <Field label="Classes per week" type="number" value={String(draft.standingSpotClassesPerWeek ?? 2)} onChange={(v) => patch({ standingSpotClassesPerWeek: Number(v) })} />
                <Field label="Max spots per class" type="number" value={String(draft.standingSpotMaxSeatsPerClass)} onChange={(v) => patch({ standingSpotMaxSeatsPerClass: Number(v) })} />
                <Field label="Default commitment (months)" type="number" value={String(standingRules.defaultCommitmentMonths)} onChange={(v) => patchStandingRules({ defaultCommitmentMonths: Number(v) })} />
                <Field label="Premium / discount %" type="number" value={String(standingRules.premiumPct)} onChange={(v) => patchStandingRules({ premiumPct: Number(v) })} />
                <Field label="Release probability %" type="number" value={String(standingRules.releaseProbabilityPct)} onChange={(v) => patchStandingRules({ releaseProbabilityPct: Number(v) })} />
                <Field label="Member attendance %" type="number" value={String(draft.standingSpotMemberAttendanceProbabilityPct ?? 90)} onChange={(v) => patch({ standingSpotMemberAttendanceProbabilityPct: Number(v) })} />
                <TaxSelect draft={draft} patch={patch} />
              </div>

              <button type="button" className="text-xs text-[#6B6560] underline" onClick={() => setShowRules(!showRules)}>
                {showRules ? "Hide" : "Show"} slot & policy rules
              </button>
              {showRules && (
                <div className="grid gap-3 rounded-lg bg-white p-4 sm:grid-cols-2">
                  <Field label="Reserved day" value={draft.standingSpotReservedDay ?? "tue"} onChange={(v) => patch({ standingSpotReservedDay: v as Product["standingSpotReservedDay"] })} />
                  <Field label="Reserved time" value={draft.standingSpotReservedTime ?? "07:00"} onChange={(v) => patch({ standingSpotReservedTime: v })} />
                  <Field label="Min commitment (months)" type="number" value={String(draft.standingSpotMinCommitmentMonths ?? 1)} onChange={(v) => patch({ standingSpotMinCommitmentMonths: Number(v) })} />
                  <Field label="Cancellation policy" value={draft.standingSpotCancellationPolicy ?? ""} onChange={(v) => patch({ standingSpotCancellationPolicy: v })} />
                  <Field label="Pause policy" value={draft.standingSpotPausePolicy ?? ""} onChange={(v) => patch({ standingSpotPausePolicy: v })} />
                  <Field label="Missed class policy" value={draft.standingSpotMissedClassPolicy ?? ""} onChange={(v) => patch({ standingSpotMissedClassPolicy: v })} />
                  <Field label="Release policy" value={standingRules.releasePolicy} onChange={(v) => patchStandingRules({ releasePolicy: v as StandingSpotRules["releasePolicy"] })} />
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={draft.standingSpotMakeUpEligible ?? false} onChange={(e) => patch({ standingSpotMakeUpEligible: e.target.checked })} />
                    Make-up eligible
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={draft.standingSpotAutoRenew ?? true} onChange={(e) => patch({ standingSpotAutoRenew: e.target.checked })} />
                    Auto-renew
                  </label>
                </div>
              )}
            </>
          )}

          {isStandby && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Price per claim (₹)" type="number" value={String(draft.price)} onChange={(v) => patch({ price: Number(v) })} />
                <Field label="Release window (hours before)" type="number" value={String(draft.standbyReleaseHoursBefore ?? 3)} onChange={(v) => patch({ standbyReleaseHoursBefore: Number(v) })} />
                <Field label="Max claims / month" type="number" value={String(draft.maxUsesPerMonth ?? 4)} onChange={(v) => patch({ maxUsesPerMonth: Number(v) })} />
                <Field label="Cannibalisation assumption %" type="number" value={String(draft.standbyCannibalisationPct ?? 30)} onChange={(v) => patch({ standbyCannibalisationPct: Number(v) })} />
                <TaxSelect draft={draft} patch={patch} />
              </div>

              <button type="button" className="text-xs text-[#6B6560] underline" onClick={() => setShowAdvanced(!showAdvanced)}>
                {showAdvanced ? "Hide" : "Show"} demand assumptions
              </button>
              {showAdvanced && (
                <div className="grid gap-3 rounded-lg bg-white p-4 sm:grid-cols-2">
                  <Field label="Expected empty seats / month" type="number" value={String(draft.standbyExpectedAvailableEmptySeats ?? 0)} onChange={(v) => patch({ standbyExpectedAvailableEmptySeats: Number(v) })} />
                  <Field label="Expected claim rate %" type="number" value={String(draft.standbyExpectedClaimRatePct ?? 55)} onChange={(v) => patch({ standbyExpectedClaimRatePct: Number(v) })} />
                  <Field label="Attendance rate %" type="number" value={String(draft.standbyAttendanceRatePct ?? 92)} onChange={(v) => patch({ standbyAttendanceRatePct: Number(v) })} />
                  <Field label="Eligible classes (comma-separated)" value={(draft.classEligibility ?? []).join(", ")} onChange={(v) => patch({ classEligibility: v.split(",").map((s) => s.trim()).filter(Boolean) })} />
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="outline" size="sm" onClick={() => onSave(draft, true)}>Save as draft</Button>
          {onPreview && (
            <Button variant="outline" size="sm" onClick={() => onPreview(draft)}>Preview impact</Button>
          )}
          <Button size="sm" onClick={() => onSave(draft, false)}>Save active</Button>
        </div>
      </div>
      <button type="button" className="fixed inset-0 -z-10" aria-label="Close" onClick={onClose} />
    </div>
  );
}

function TaxSelect({ draft, patch }: { draft: Product; patch: (p: Partial<Product>) => void }) {
  return (
    <div>
      <label className="text-xs text-[#A39E98]">Tax treatment</label>
      <select
        className="mt-1 w-full rounded-md border border-[#E8E2D9] bg-white px-3 py-2 text-sm"
        value={draft.gstFollowsGlobal !== false ? "global" : draft.gstTreatment}
        onChange={(e) => {
          if (e.target.value === "global") patch({ gstFollowsGlobal: true });
          else patch({ gstFollowsGlobal: false, gstTreatment: e.target.value as "inclusive" | "exclusive" });
        }}
      >
        <option value="global">Follow global setting</option>
        <option value="inclusive">GST inclusive</option>
        <option value="exclusive">GST exclusive</option>
      </select>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-[#A39E98]">{label}</span>
      <Input className="mt-1" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
