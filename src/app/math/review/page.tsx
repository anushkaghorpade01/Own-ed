"use client";

import { useMemo, useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/lib/store/app-store";
import { SectionHeader } from "@/components/shared/metric-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import {
  MATH_REVIEW_AREAS,
  MATH_REVIEW_TYPE_LABELS,
  MATH_REVIEW_STATUS_LABELS,
  MATH_REVIEW_ACCURACY_LABELS,
  getMathReviewArea,
} from "@/lib/finance/math-review-areas";
import type { MathReviewItem } from "@/lib/finance/schemas";
import { Trash2, ExternalLink } from "lucide-react";

const STATUS_STYLE: Record<MathReviewItem["status"], string> = {
  open: "bg-amber-50 text-amber-900",
  acknowledged: "bg-blue-50 text-blue-900",
  fixed: "bg-emerald-50 text-emerald-800",
  wont_fix: "bg-[var(--surface-muted)] text-[var(--text-secondary)]",
  verified: "bg-emerald-100 text-emerald-900",
};

const ACCURACY_STYLE: Record<MathReviewItem["accuracyRating"], string> = {
  not_reviewed: "bg-[var(--surface-muted)] text-[var(--text-muted)]",
  looks_correct: "bg-emerald-50 text-emerald-800",
  needs_review: "bg-amber-50 text-amber-900",
  incorrect: "bg-red-50 text-red-800",
};

function newReviewId() {
  return `review-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function MathReviewPageContent() {
  const searchParams = useSearchParams();
  const { state, addMathReviewItem, updateMathReviewItem, deleteMathReviewItem } = useApp();

  const prefillArea = searchParams.get("area") ?? "overview";

  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<MathReviewItem["status"] | "all">("all");
  const [filterArea, setFilterArea] = useState<string>("all");

  const [form, setForm] = useState({
    areaId: prefillArea,
    reviewType: "accuracy_check" as MathReviewItem["reviewType"],
    accuracyRating: "not_reviewed" as MathReviewItem["accuracyRating"],
    confidenceScore: 3,
    title: "",
    notes: "",
    expectedValue: "",
    actualValue: "",
    reviewerName: "",
    priority: "medium" as MathReviewItem["priority"],
  });

  useEffect(() => {
    if (prefillArea) {
      setForm((f) => ({ ...f, areaId: prefillArea }));
      if (searchParams.get("new") === "1") setShowForm(true);
    }
  }, [prefillArea, searchParams]);

  const items = state.mathReviewItems;

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (filterStatus !== "all" && item.status !== filterStatus) return false;
      if (filterArea !== "all" && item.areaId !== filterArea) return false;
      return true;
    });
  }, [items, filterStatus, filterArea]);

  const summary = useMemo(() => {
    const open = items.filter((i) => i.status === "open").length;
    const bugs = items.filter((i) => i.reviewType === "calculation_bug" && i.status !== "fixed").length;
    const verified = items.filter((i) => i.status === "verified" || i.accuracyRating === "looks_correct").length;
    return { open, bugs, verified, total: items.length };
  }, [items]);

  const handleSubmit = () => {
    const area = getMathReviewArea(form.areaId) ?? MATH_REVIEW_AREAS[0];
    const now = new Date().toISOString();
    addMathReviewItem({
      id: newReviewId(),
      areaId: area.id,
      areaLabel: area.label,
      pageHref: area.href,
      reviewType: form.reviewType,
      accuracyRating: form.accuracyRating,
      confidenceScore: form.confidenceScore,
      title: form.title.trim() || `${area.label} review`,
      notes: form.notes.trim(),
      expectedValue: form.expectedValue.trim() || undefined,
      actualValue: form.actualValue.trim() || undefined,
      reviewerName: form.reviewerName.trim() || undefined,
      status: "open",
      priority: form.priority,
      createdAt: now,
      updatedAt: now,
    });
    setForm((f) => ({
      ...f,
      title: "",
      notes: "",
      expectedValue: "",
      actualValue: "",
    }));
    setShowForm(false);
  };

  return (
    <div>
      <SectionHeader
        title="Math Review"
        description="A shared verification log for founders, family, and advisors (including your CA). Flag what looks wrong, rate accuracy, and track fixes — without changing the live model until you're ready."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <div className="card-surface">
          <p className="text-label">Open items</p>
          <p className="text-kpi mt-1">{summary.open}</p>
        </div>
        <div className="card-surface">
          <p className="text-label">Possible bugs</p>
          <p className="text-kpi mt-1">{summary.bugs}</p>
        </div>
        <div className="card-surface">
          <p className="text-label">Verified / correct</p>
          <p className="text-kpi mt-1">{summary.verified}</p>
        </div>
        <div className="card-surface">
          <p className="text-label">Total notes</p>
          <p className="text-kpi mt-1">{summary.total}</p>
        </div>
      </div>

      <section className="card-surface mb-6">
        <p className="text-body-sm text-[var(--text-secondary)]">
          <strong className="text-[var(--text-primary)]">How to use this with your CA:</strong>{" "}
          Walk through each Math section. When something doesn&apos;t match expectations, log it
          here with what you expected vs what Own-ed shows. Mark items fixed once the model is
          updated. This creates an audit trail your advisor can follow asynchronously.
        </p>
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add review note"}
        </Button>
        <select
          value={filterArea}
          onChange={(e) => setFilterArea(e.target.value)}
          className="rounded-md border border-[var(--border-subtle)] bg-white px-2 py-1.5 text-body-sm"
        >
          <option value="all">All areas</option>
          {MATH_REVIEW_AREAS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          className="rounded-md border border-[var(--border-subtle)] bg-white px-2 py-1.5 text-body-sm"
        >
          <option value="all">All statuses</option>
          {(Object.keys(MATH_REVIEW_STATUS_LABELS) as MathReviewItem["status"][]).map((s) => (
            <option key={s} value={s}>
              {MATH_REVIEW_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {showForm && (
        <section className="card-surface mb-6 space-y-4">
          <p className="text-label">New review note</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-body-sm">
              <span className="text-label mb-1 block">Math area</span>
              <select
                value={form.areaId}
                onChange={(e) => setForm((f) => ({ ...f, areaId: e.target.value }))}
                className="w-full rounded-md border border-[var(--border-subtle)] px-2 py-1.5"
              >
                {MATH_REVIEW_AREAS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.group}: {a.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-body-sm">
              <span className="text-label mb-1 block">Review type</span>
              <select
                value={form.reviewType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    reviewType: e.target.value as MathReviewItem["reviewType"],
                  }))
                }
                className="w-full rounded-md border border-[var(--border-subtle)] px-2 py-1.5"
              >
                {(Object.keys(MATH_REVIEW_TYPE_LABELS) as MathReviewItem["reviewType"][]).map(
                  (t) => (
                    <option key={t} value={t}>
                      {MATH_REVIEW_TYPE_LABELS[t]}
                    </option>
                  )
                )}
              </select>
            </label>
            <label className="block text-body-sm">
              <span className="text-label mb-1 block">Reviewer name</span>
              <Input
                placeholder="e.g. Papa, CA firm"
                value={form.reviewerName}
                onChange={(e) => setForm((f) => ({ ...f, reviewerName: e.target.value }))}
              />
            </label>
            <label className="block text-body-sm">
              <span className="text-label mb-1 block">Accuracy rating</span>
              <select
                value={form.accuracyRating}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    accuracyRating: e.target.value as MathReviewItem["accuracyRating"],
                  }))
                }
                className="w-full rounded-md border border-[var(--border-subtle)] px-2 py-1.5"
              >
                {(Object.keys(MATH_REVIEW_ACCURACY_LABELS) as MathReviewItem["accuracyRating"][]).map(
                  (r) => (
                    <option key={r} value={r}>
                      {MATH_REVIEW_ACCURACY_LABELS[r]}
                    </option>
                  )
                )}
              </select>
            </label>
            <label className="block text-body-sm">
              <span className="text-label mb-1 block">Confidence (1–5)</span>
              <Input
                type="number"
                min={1}
                max={5}
                value={form.confidenceScore}
                onChange={(e) =>
                  setForm((f) => ({ ...f, confidenceScore: parseInt(e.target.value, 10) || 3 }))
                }
              />
            </label>
            <label className="block text-body-sm">
              <span className="text-label mb-1 block">Priority</span>
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    priority: e.target.value as MathReviewItem["priority"],
                  }))
                }
                className="w-full rounded-md border border-[var(--border-subtle)] px-2 py-1.5"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>
          <label className="block text-body-sm">
            <span className="text-label mb-1 block">Title</span>
            <Input
              placeholder="Short summary — e.g. Cash flow Month 1 sign looks wrong"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-body-sm">
              <span className="text-label mb-1 block">Expected (optional)</span>
              <Input
                placeholder="What you / your CA expect"
                value={form.expectedValue}
                onChange={(e) => setForm((f) => ({ ...f, expectedValue: e.target.value }))}
              />
            </label>
            <label className="block text-body-sm">
              <span className="text-label mb-1 block">Model shows (optional)</span>
              <Input
                placeholder="What Own-ed currently displays"
                value={form.actualValue}
                onChange={(e) => setForm((f) => ({ ...f, actualValue: e.target.value }))}
              />
            </label>
          </div>
          <label className="block text-body-sm">
            <span className="text-label mb-1 block">Notes</span>
            <textarea
              rows={4}
              placeholder="Detailed feedback, CA comments, or recommended formula changes…"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-body-sm"
            />
          </label>
          <Button type="button" onClick={handleSubmit}>
            Save review note
          </Button>
        </section>
      )}

      <section className="space-y-3">
        {filtered.length === 0 ? (
          <div className="card-surface text-body-sm text-[var(--text-muted)]">
            No review notes yet. Add one when you or your CA spot something to verify or fix.
          </div>
        ) : (
          filtered.map((item) => (
            <article key={item.id} className="card-surface">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-caption uppercase",
                        STATUS_STYLE[item.status]
                      )}
                    >
                      {MATH_REVIEW_STATUS_LABELS[item.status]}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-caption",
                        ACCURACY_STYLE[item.accuracyRating]
                      )}
                    >
                      {MATH_REVIEW_ACCURACY_LABELS[item.accuracyRating]}
                    </span>
                    <span className="text-caption text-[var(--text-muted)]">
                      {MATH_REVIEW_TYPE_LABELS[item.reviewType]}
                    </span>
                  </div>
                  <h3 className="text-h2 mt-2">{item.title}</h3>
                  <p className="text-caption mt-1 text-[var(--text-muted)]">
                    {item.areaLabel}
                    {item.reviewerName ? ` · ${item.reviewerName}` : ""} ·{" "}
                    {new Date(item.updatedAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={item.pageHref}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-2 py-1 text-caption hover:bg-[var(--surface-muted)]"
                  >
                    View page <ExternalLink className="h-3 w-3" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => deleteMathReviewItem(item.id)}
                    className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-red-50 hover:text-red-700"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {item.notes && (
                <p className="text-body-sm mt-3 whitespace-pre-wrap text-[var(--text-secondary)]">
                  {item.notes}
                </p>
              )}

              {(item.expectedValue || item.actualValue) && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 text-body-sm">
                  {item.expectedValue && (
                    <div className="rounded-md bg-[var(--surface-muted)] px-3 py-2">
                      <p className="text-label">Expected</p>
                      <p>{item.expectedValue}</p>
                    </div>
                  )}
                  {item.actualValue && (
                    <div className="rounded-md bg-[var(--surface-muted)] px-3 py-2">
                      <p className="text-label">Model shows</p>
                      <p>{item.actualValue}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <select
                  value={item.status}
                  onChange={(e) =>
                    updateMathReviewItem(item.id, {
                      status: e.target.value as MathReviewItem["status"],
                    })
                  }
                  className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-caption"
                >
                  {(Object.keys(MATH_REVIEW_STATUS_LABELS) as MathReviewItem["status"][]).map(
                    (s) => (
                      <option key={s} value={s}>
                        {MATH_REVIEW_STATUS_LABELS[s]}
                      </option>
                    )
                  )}
                </select>
                <select
                  value={item.accuracyRating}
                  onChange={(e) =>
                    updateMathReviewItem(item.id, {
                      accuracyRating: e.target.value as MathReviewItem["accuracyRating"],
                    })
                  }
                  className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-caption"
                >
                  {(Object.keys(MATH_REVIEW_ACCURACY_LABELS) as MathReviewItem["accuracyRating"][]).map(
                    (r) => (
                      <option key={r} value={r}>
                        {MATH_REVIEW_ACCURACY_LABELS[r]}
                      </option>
                    )
                  )}
                </select>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="card-surface mt-8">
        <p className="text-label mb-3">Areas to review</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MATH_REVIEW_AREAS.map((area) => {
            const areaItems = items.filter((i) => i.areaId === area.id);
            const openCount = areaItems.filter((i) => i.status === "open").length;
            return (
              <Link
                key={area.id}
                href={`/math/review?area=${area.id}&new=1`}
                className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 hover:bg-[var(--surface-muted)]"
              >
                <p className="text-body-sm font-medium">{area.label}</p>
                <p className="text-caption text-[var(--text-muted)]">{area.description}</p>
                {openCount > 0 && (
                  <p className="text-caption mt-1 text-amber-800">{openCount} open</p>
                )}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default function MathReviewPage() {
  return (
    <Suspense fallback={<div className="text-body-sm text-[var(--text-muted)]">Loading…</div>}>
      <MathReviewPageContent />
    </Suspense>
  );
}
