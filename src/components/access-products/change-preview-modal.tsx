"use client";

import type { ProductChangeImpact } from "@/lib/finance/engine/product-catalog";
import { Button } from "@/components/ui/button";

export interface ChangePreviewModalProps {
  changeLines: string[];
  impact: ProductChangeImpact;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ChangePreviewModal({
  changeLines,
  impact,
  onConfirm,
  onCancel,
}: ChangePreviewModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/30 pt-[10vh] backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-xl border border-[#E8E2D9] bg-white p-6 shadow-xl">
        <h2 className="font-serif text-xl text-[#2C2825]">What will change?</h2>
        <p className="mt-2 text-sm text-[#6B6560]">You are changing:</p>
        <ul className="mt-2 list-inside list-disc text-sm text-[#2C2825]">
          {changeLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-[#A39E98]">
          Estimated model impact (Base Case)
        </p>
        <div className="mt-2 space-y-2">
          {impact.rows.map((row) => (
            <div key={row.label} className="flex justify-between text-sm border-b border-[#F0EBE3] pb-1">
              <span className="text-[#6B6560]">{row.label}</span>
              <span className="font-medium">
                {row.before} → {row.after}
              </span>
            </div>
          ))}
        </div>
        {impact.summaryLines.length > 0 && (
          <div className="mt-3 text-xs text-[#6B6560]">
            {impact.summaryLines.map((s) => (
              <p key={s}>{s}</p>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={onConfirm}>Save change</Button>
        </div>
      </div>
      <button type="button" className="fixed inset-0 -z-10" aria-label="Close" onClick={onCancel} />
    </div>
  );
}
