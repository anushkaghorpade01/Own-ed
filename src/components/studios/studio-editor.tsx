"use client";

import type { Studio } from "@/lib/finance/schemas";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

function parseOptionalNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function packPricesToLines(packPrices: Record<string, number>): string {
  return Object.entries(packPrices)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

function linesToPackPrices(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const sep = trimmed.includes(":") ? ":" : trimmed.includes("—") ? "—" : null;
    if (!sep) continue;
    const [label, ...rest] = trimmed.split(sep);
    const price = parseOptionalNumber(rest.join(sep));
    if (label?.trim() && price != null) out[label.trim()] = price;
  }
  return out;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-[#A39E98]">{children}</p>;
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      className="w-full rounded-lg border border-[#E0DAD2] bg-white px-3 py-2 text-sm text-[#2C2825] placeholder:text-[#A39E98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C4A882]/40"
      rows={rows}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-[#2C2825]">{title}</h3>
      {children}
    </section>
  );
}

export interface StudioEditorProps {
  studio: Studio;
  onUpdate: (updates: Partial<Studio>) => void;
  onClose: () => void;
  onDelete?: () => void;
}

export function StudioEditor({ studio, onUpdate, onClose, onDelete }: StudioEditorProps) {
  const patch = (updates: Partial<Studio>) => onUpdate(updates);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
      <button type="button" className="flex-1" aria-label="Close editor" onClick={onClose} />
      <div className="flex h-full w-full max-w-xl flex-col border-l border-[#E0DAD2] bg-[#FFFCF8] shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#E0DAD2] px-5 py-4">
          <div className="min-w-0 flex-1">
            <Input
              value={studio.name}
              onChange={(e) => patch({ name: e.target.value })}
              className="text-lg font-semibold"
              placeholder="Studio name"
            />
            <Input
              value={studio.location ?? ""}
              onChange={(e) => patch({ location: e.target.value || undefined })}
              className="mt-2"
              placeholder="Neighbourhood / city"
            />
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-5 py-5">
          <Section title="Visit">
            <label className="flex items-center gap-2 text-sm text-[#2C2825]">
              <input
                type="checkbox"
                checked={studio.visited}
                onChange={(e) =>
                  patch({
                    visited: e.target.checked,
                    visitDate: e.target.checked && !studio.visitDate
                      ? new Date().toISOString().slice(0, 10)
                      : studio.visitDate,
                  })
                }
                className="rounded border-[#E0DAD2]"
              />
              I visited this studio
            </label>
            {studio.visited && (
              <div>
                <FieldLabel>Visit date</FieldLabel>
                <Input
                  type="date"
                  value={studio.visitDate ?? ""}
                  onChange={(e) => patch({ visitDate: e.target.value || undefined })}
                />
              </div>
            )}
          </Section>

          <Section title="Links">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>Website</FieldLabel>
                <Input
                  value={studio.website ?? ""}
                  onChange={(e) => patch({ website: e.target.value || undefined })}
                  placeholder="https://…"
                />
              </div>
              <div>
                <FieldLabel>Instagram</FieldLabel>
                <Input
                  value={studio.instagram ?? ""}
                  onChange={(e) => patch({ instagram: e.target.value || undefined })}
                  placeholder="@handle or URL"
                />
              </div>
            </div>
          </Section>

          <Section title="Capacity & setup">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <FieldLabel>Reformers</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  value={studio.reformers ?? ""}
                  onChange={(e) => patch({ reformers: parseOptionalNumber(e.target.value) })}
                  placeholder="e.g. 8"
                />
              </div>
              <div>
                <FieldLabel>Max class size</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  value={studio.maxClassSize ?? ""}
                  onChange={(e) => patch({ maxClassSize: parseOptionalNumber(e.target.value) })}
                  placeholder="e.g. 3"
                />
              </div>
              <div>
                <FieldLabel>Instructors (observed)</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  value={studio.instructorCount ?? ""}
                  onChange={(e) => patch({ instructorCount: parseOptionalNumber(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <FieldLabel>Class formats (comma-separated)</FieldLabel>
              <Input
                value={studio.classFormats.join(", ")}
                onChange={(e) =>
                  patch({
                    classFormats: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="Reformer, Mat, Private,…"
              />
            </div>
          </Section>

          <Section title="Pricing observed">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>Drop-in (₹)</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  value={studio.dropInPrice ?? ""}
                  onChange={(e) => patch({ dropInPrice: parseOptionalNumber(e.target.value) })}
                />
              </div>
              <div>
                <FieldLabel>Private session (₹)</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  value={studio.privatePrice ?? ""}
                  onChange={(e) => patch({ privatePrice: parseOptionalNumber(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <FieldLabel>Pack prices (one per line: label: amount)</FieldLabel>
              <TextArea
                value={packPricesToLines(studio.packPrices)}
                onChange={(text) => patch({ packPrices: linesToPackPrices(text) })}
                placeholder={"10 credits: 8500\n20 credits: 15000"}
                rows={4}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>Intro offer</FieldLabel>
                <Input
                  value={studio.introOffer ?? ""}
                  onChange={(e) => patch({ introOffer: e.target.value || undefined })}
                  placeholder="First class free, 3 for ₹999…"
                />
              </div>
              <div>
                <FieldLabel>Membership</FieldLabel>
                <Input
                  value={studio.membership ?? ""}
                  onChange={(e) => patch({ membership: e.target.value || undefined })}
                  placeholder="Unlimited ₹12k/mo…"
                />
              </div>
            </div>
            <div>
              <FieldLabel>Pricing notes</FieldLabel>
              <TextArea
                value={studio.pricingNotes ?? ""}
                onChange={(v) => patch({ pricingNotes: v || undefined })}
                placeholder="GST included? Hidden fees? How packs compare to drop-in…"
              />
            </div>
          </Section>

          <Section title="Operations">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>Opening hours</FieldLabel>
                <Input
                  value={studio.openingHours ?? ""}
                  onChange={(e) => patch({ openingHours: e.target.value || undefined })}
                  placeholder="Mon–Sat 6am–9pm"
                />
              </div>
              <div>
                <FieldLabel>Booking system</FieldLabel>
                <Input
                  value={studio.bookingSystem ?? ""}
                  onChange={(e) => patch({ bookingSystem: e.target.value || undefined })}
                  placeholder="Mindbody, custom app…"
                />
              </div>
            </div>
            <div>
              <FieldLabel>Cancellation policy</FieldLabel>
              <TextArea
                value={studio.cancellationPolicy ?? ""}
                onChange={(v) => patch({ cancellationPolicy: v || undefined })}
                placeholder="12-hour window, no-show fee…"
              />
            </div>
          </Section>

          <Section title="Ratings">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>Google rating</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={studio.googleRating ?? ""}
                  onChange={(e) => patch({ googleRating: parseOptionalNumber(e.target.value) })}
                />
              </div>
              <div>
                <FieldLabel>Your rating (1–10)</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={studio.personalRating ?? ""}
                  onChange={(e) => patch({ personalRating: parseOptionalNumber(e.target.value) })}
                />
              </div>
            </div>
          </Section>

          <Section title="Crowd & positioning">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>Target customer (their vibe)</FieldLabel>
                <Input
                  value={studio.targetCustomer ?? ""}
                  onChange={(e) => patch({ targetCustomer: e.target.value || undefined })}
                />
              </div>
              <div>
                <FieldLabel>Observed crowd</FieldLabel>
                <Input
                  value={studio.observedCrowd ?? ""}
                  onChange={(e) => patch({ observedCrowd: e.target.value || undefined })}
                />
              </div>
            </div>
            <div>
              <FieldLabel>How busy was it?</FieldLabel>
              <Input
                value={studio.howBusy ?? ""}
                onChange={(e) => patch({ howBusy: e.target.value || undefined })}
                placeholder="Half full evening class, waitlist on weekends…"
              />
            </div>
          </Section>

          <Section title="My notes">
            <TextArea
              value={studio.notes ?? ""}
              onChange={(v) => patch({ notes: v || undefined })}
              placeholder="Free-form comments — anything else you want to remember about this studio…"
              rows={5}
            />
          </Section>

          <Section title="Intelligence notes">
            <div>
              <FieldLabel>What I liked</FieldLabel>
              <TextArea
                value={studio.liked ?? ""}
                onChange={(v) => patch({ liked: v || undefined })}
              />
            </div>
            <div>
              <FieldLabel>What I disliked</FieldLabel>
              <TextArea
                value={studio.disliked ?? ""}
                onChange={(v) => patch({ disliked: v || undefined })}
              />
            </div>
            <div>
              <FieldLabel>What was exceptional</FieldLabel>
              <TextArea
                value={studio.exceptional ?? ""}
                onChange={(v) => patch({ exceptional: v || undefined })}
              />
            </div>
            <div>
              <FieldLabel>What was missing</FieldLabel>
              <TextArea
                value={studio.missing ?? ""}
                onChange={(v) => patch({ missing: v || undefined })}
              />
            </div>
            <div>
              <FieldLabel>OWN could learn</FieldLabel>
              <TextArea
                value={studio.ownCouldLearn ?? ""}
                onChange={(v) => patch({ ownCouldLearn: v || undefined })}
              />
            </div>
            <div>
              <FieldLabel>OWN should never copy</FieldLabel>
              <TextArea
                value={studio.ownNeverCopy ?? ""}
                onChange={(v) => patch({ ownNeverCopy: v || undefined })}
              />
            </div>
            <div>
              <FieldLabel>Product gaps / opportunities</FieldLabel>
              <TextArea
                value={studio.productGaps ?? ""}
                onChange={(v) => patch({ productGaps: v || undefined })}
              />
            </div>
            <div>
              <FieldLabel>Other interesting details</FieldLabel>
              <TextArea
                value={studio.interestingDetails ?? ""}
                onChange={(v) => patch({ interestingDetails: v || undefined })}
                rows={4}
              />
            </div>
          </Section>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#E0DAD2] px-5 py-4">
          {onDelete ? (
            <button
              type="button"
              className="text-sm text-red-600 hover:underline"
              onClick={onDelete}
            >
              Delete studio
            </button>
          ) : (
            <span />
          )}
          <Button type="button" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

export function studioSummaryFilled(studio: Studio): boolean {
  return Boolean(
    studio.location ||
      studio.visited ||
      studio.dropInPrice ||
      studio.reformers ||
      studio.liked ||
      studio.ownCouldLearn
  );
}

export function studioCardClass(selected: boolean): string {
  return cn(
    "cursor-pointer transition-shadow hover:shadow-md",
    selected && "ring-2 ring-[#C4A882]/50"
  );
}
