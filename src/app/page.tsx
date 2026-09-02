"use client";

import { useMemo } from "react";
import { useApp } from "@/lib/store/app-store";
import { runFinanceModel } from "@/lib/finance";
import { formatINR, formatPercent } from "@/lib/format/currency";
import {
  MetricCard,
  MetricGrid,
  PageSection,
  SectionHeader,
  SampleStatusChip,
  BusinessInsightCard,
} from "@/components/shared/metric-card";
import { SetupCompleteness } from "@/components/setup/setup-completeness";
import { explainOwnerCompensation } from "@/lib/finance/business-insights";
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
  const model = useMemo(() => runFinanceModel(state.assumptions), [state.assumptions]);

  const openDecisions = state.decisions.filter((d) => d.status !== "reversed").length;
  const openQuestions = state.questions.filter((q) => q.status === "open");
  const ownerCompInsight = explainOwnerCompensation(model);

  return (
    <div>
      <SectionHeader title="Your Dashboard" />
      <SampleStatusChip />

      {ownerCompInsight && (
        <PageSection spacing="default">
          <BusinessInsightCard {...ownerCompInsight} />
        </PageSection>
      )}

      <PageSection spacing="default">
        <SetupCompleteness showCompleteLink />
      </PageSection>

      <MetricGrid className="page-section-major">
        <MetricCard
          label="Launch investment"
          value={formatINR(model.summary.launchInvestment)}
          subtitle="Non-recoverable capex + working capital"
          href="/math/assumptions"
          definition="Non-recoverable setup capex plus working capital required before opening. Edit line items under Assumptions → Setup investment."
          whyItMatters="This is the cash you need to commit before the studio generates revenue."
        />
        <MetricCard
          label="Base-case monthly revenue"
          value={formatINR(model.summary.monthlyRevenue)}
          subtitle="Net sales (ex-GST)"
          href="/math/pl"
          trace={model.revenue.traces.groupClass}
        />
        <MetricCard
          label="Monthly operating profit"
          value={formatINR(model.pl.ebitda)}
          subtitle="EBITDA at current occupancy"
          href="/math/pl"
          trace={model.pl.traces.ebitda}
        />
        <MetricCard
          label="Break-even occupancy"
          value={formatPercent(model.summary.breakEvenOccupancyPct)}
          subtitle="Contribution break-even"
          href="/math/break-even"
          trace={model.breakEven.contributionBreakEven.trace}
          definition="The percentage of available reformer spots that need to be occupied for contribution margin to cover fixed operating costs (rent, salaries, etc.). This is lower than EBITDA break-even — see Break-even page for all four metrics."
          whyItMatters="Tells you how full the studio needs to be before fixed costs are covered by class contribution — not the same as EBITDA break-even or cash break-even."
        />
        <MetricCard
          label="Investment payback"
          value={
            model.payback.paybackNotReached
              ? "Not reached (36mo)"
              : `Month ${model.payback.paybackMonth}`
          }
          subtitle="Cumulative operating cash (earned-revenue timing)"
          href="/math/payback"
          trace={model.payback.trace}
        />
        <MetricCard label="Reformers" value={String(model.summary.reformers)} href="/math/assumptions" size="compact" />
        <MetricCard
          label="Weekly classes"
          value={model.summary.weeklyClasses.toFixed(0)}
          href="/math/capacity"
          size="compact"
        />
        <MetricCard
          label="Projected utilisation"
          value={formatPercent(model.summary.utilisationPct)}
          href="/math/capacity"
          size="compact"
        />
        <MetricCard
          label="Studios researched"
          value={String(state.studios.length)}
          href="/studios"
          size="compact"
        />
        <MetricCard label="Open decisions" value={String(openDecisions)} href="/" size="compact" />
        <MetricCard
          label="Target opening"
          value={
            state.assumptions.targetOpeningDate
              ? format(new Date(state.assumptions.targetOpeningDate), "d MMM yyyy")
              : "Not set"
          }
          href="/math/assumptions"
          size="compact"
        />
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

      {model.validationErrors.length > 0 && (
        <div className="mt-[var(--space-6)] rounded-lg border border-[#E8C4C4] bg-[#FCEAEA] px-[var(--space-4)] py-[var(--space-3)]">
          <p className="text-body font-medium text-[#8B3A3A]">Validation warnings</p>
          <ul className="text-caption mt-1 list-inside list-disc text-[#8B3A3A]">
            {model.validationErrors.map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
