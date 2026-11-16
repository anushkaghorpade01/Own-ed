"use client";

import { useMemo } from "react";
import { useApp } from "@/lib/store/app-store";
import {correctionState} from "@/lib/finance/current/selected";
import { useTeacherFirstFinance } from "@/lib/store/teacher-first-store";
import { formatINR } from "@/lib/format/currency";
import {
  MetricCard,
  MetricGrid,
  PageSection,
  SectionHeader,
} from "@/components/shared/metric-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { format } from "date-fns";

const statusColors = {
  testing: "warning" as const,
  provisional: "secondary" as const,
  locked: "success" as const,
  reversed: "danger" as const,
};

export default function HomePage() {
  const { state } = useApp();
  const {finance} = useTeacherFirstFinance();
  const selected=useMemo(()=>correctionState(finance),[finance]);
  const month=selected.result?.rows[finance.selection.month-1];

  const openDecisions = state.decisions.filter((d) => d.status !== "reversed").length;
  const openQuestions = state.questions.filter((q) => q.status === "open");

  return (
    <div>
      <SectionHeader title="Your Dashboard" />
      <PageSection spacing="default"><div className="rounded-xl border border-[#E8E2D9] bg-white p-4 text-sm"><p className="font-semibold">Working financial forecast</p><p className="mt-2">{selected.reason}</p>{selected.result&&!selected.result.capacityStatus.passesCoarseMonthlyPlanning&&<p className="mt-2 text-red-800 font-semibold">Demand exceeds planning capacity. Financial outputs are not an attainable forecast.</p>}<div className="flex gap-4 mt-3"><Link href="/math/workbench" className="underline">Scenario settings</Link><Link href="/math/scenarios" className="underline">Full financial plan</Link></div></div></PageSection>
      <MetricGrid className="page-section-major">
        {month&&<><MetricCard label="Monthly sales excluding GST" value={formatINR(month.netSales)} subtitle={`Working scenario M${month.month}`} href="/math/pl"/><MetricCard label="Monthly profit proxy" value={formatINR(month.netProfit)} subtitle="Sale-basis, after founder pay" href="/math/pl"/><MetricCard label="Closing cash + FD" value={formatINR(month.cash)} subtitle={month.breach?'Below cash policy floor':'Above cash policy floor'} href="/math/cash-flow"/><MetricCard label="Monthly pack buyers" value={month.packBuyers.toFixed(1)} subtitle={`${month.averageActivePackHolders.toFixed(1)} average valid-pack holders`} href="/math/sales-target"/></>}
        <MetricCard label="Studios researched" value={String(state.studios.length)} href="/studios" size="compact"/><MetricCard label="Open decisions" value={String(openDecisions)} href="/" size="compact"/>
      </MetricGrid>

      <div className="page-section-major grid gap-[var(--space-grid-gap)] lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent decisions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-[var(--space-4)]">
            {state.decisions.length === 0 ? (
              <p className="text-body-sm text-[var(--text-muted)]">No decisions recorded yet.</p>
            ) : (
              state.decisions.slice(0, 5).map((d) => (
                <div key={d.id} className="border-b border-[var(--border-subtle)] pb-[var(--space-3)] last:border-0">
                  <div className="flex items-center gap-[var(--space-2)]">
                    <Badge variant={statusColors[d.status]}>{d.status}</Badge>
                    <span className="text-caption">{format(new Date(d.date), "d MMM yyyy")}</span>
                  </div>
                  <p className="text-body mt-1 font-medium text-[var(--text-primary)]">{d.decision}</p>
                  {d.reasoning && (
                    <p className="text-caption mt-0.5 text-[var(--text-secondary)]">{d.reasoning}</p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-[var(--space-3)]">
            {openQuestions.map((q) => (
              <div key={q.id} className="rounded-lg bg-[var(--surface-page)] px-[var(--space-4)] py-[var(--space-3)]">
                <p className="text-body text-[var(--text-primary)]">{q.question}</p>
                {q.context && <p className="text-caption mt-1 text-[var(--text-secondary)]">{q.context}</p>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-[var(--space-2)]">
            {state.actions.filter((a) => !a.completed).length === 0 ? (
              <p className="text-body-sm text-[var(--text-muted)]">No open actions.</p>
            ) : (
              state.actions
                .filter((a) => !a.completed)
                .slice(0, 5)
                .map((a) => (
                  <Link
                    key={a.id}
                    href={a.link ?? "#"}
                    className="flex items-center justify-between rounded-lg px-[var(--space-3)] py-[var(--space-2)] text-body hover:bg-[var(--surface-page)]"
                  >
                    <span className="text-[var(--text-primary)]">{a.title}</span>
                    {a.dueDate && (
                      <span className="text-caption">{format(new Date(a.dueDate), "d MMM")}</span>
                    )}
                  </Link>
                ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recently added research</CardTitle>
          </CardHeader>
          <CardContent className="space-y-[var(--space-2)]">
            {state.libraryItems.length === 0 && state.studios.length === 0 ? (
              <p className="text-body-sm text-[var(--text-muted)]">No research added yet.</p>
            ) : (
              <>
                {state.libraryItems.slice(0, 4).map((item) => (
                  <Link
                    key={item.id}
                    href="/library"
                    className="block rounded-lg px-[var(--space-3)] py-[var(--space-2)] text-body hover:bg-[var(--surface-page)]"
                  >
                    <span className="text-label">{item.type}</span>
                    <p className="text-[var(--text-primary)]">{item.title}</p>
                  </Link>
                ))}
                {state.studios.slice(0, 2).map((s) => (
                  <Link
                    key={s.id}
                    href="/studios"
                    className="block rounded-lg px-[var(--space-3)] py-[var(--space-2)] text-body hover:bg-[var(--surface-page)]"
                  >
                    <span className="text-label">Studio</span>
                    <p className="text-[var(--text-primary)]">{s.name}</p>
                  </Link>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {month?.breach&&<div className="mt-6 rounded-lg border border-[#E8C4C4] bg-[#FCEAEA] p-4 text-sm text-[#8B3A3A]"><p>M{month.month} closing cash is below the cash policy floor. This is a funding risk, not spare cash to distribute.</p></div>}

    </div>
  );
}
