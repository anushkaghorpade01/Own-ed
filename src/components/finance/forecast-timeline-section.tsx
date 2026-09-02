"use client";

import { Plus, Trash2 } from "lucide-react";
import { useApp } from "@/lib/store/app-store";
import {
  AssumptionSection,
  DraftInlineNumber,
  DraftTextField,
  useSectionContext,
} from "@/components/finance/assumption-section";
import { Button } from "@/components/ui/button";
import { resolveForecastSettings } from "@/lib/finance/engine/escalation";
import type { ScenarioTimelinePhase } from "@/lib/finance/schemas";

function newPhase(partial?: Partial<ScenarioTimelinePhase>): ScenarioTimelinePhase {
  return {
    id: `forecast-phase-${Date.now()}`,
    label: partial?.label ?? "New phase",
    startMonth: partial?.startMonth ?? 13,
    endMonth: partial?.endMonth ?? 36,
    assumptionOverrides: partial?.assumptionOverrides ?? {},
  };
}

type TimelineDraft = {
  forecastTimeline: ScenarioTimelinePhase[];
};

function ForecastTimelineBody() {
  const { state } = useApp();
  const a = state.assumptions;
  const forecast = resolveForecastSettings(a);
  const { draft, patch } = useSectionContext<TimelineDraft>();
  const phases = draft.forecastTimeline;

  const updatePhase = (id: string, updates: Partial<ScenarioTimelinePhase>) => {
    patch({
      forecastTimeline: phases.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    });
  };

  const updatePhaseOverride = (
    id: string,
    key: string,
    value: number | boolean | undefined
  ) => {
    const phase = phases.find((p) => p.id === id);
    if (!phase) return;
    const overrides = { ...phase.assumptionOverrides };
    if (value === undefined) {
      delete overrides[key];
    } else {
      overrides[key] = value;
    }
    updatePhase(id, { assumptionOverrides: overrides });
  };

  const addPhase = () => {
    patch({
      forecastTimeline: [
        ...phases,
        newPhase({
          label: "Add 4th reformer",
          startMonth: 13,
          endMonth: forecast.forecastYears * 12,
          assumptionOverrides: { reformers: a.reformers + 1 },
        }),
      ],
    });
  };

  const removePhase = (id: string) => {
    patch({ forecastTimeline: phases.filter((p) => p.id !== id) });
  };

  return (
    <>
      <p className="mb-4 text-xs text-[#6B6560]">
        Model capacity and service changes over time — e.g. a 4th reformer in Year 2, extra
        classes/day, or activating Standing Spot. These apply from the configured month and feed
        into the yearly P&amp;L and profit tooltips.
      </p>

      {phases.length === 0 ? (
        <Button type="button" size="sm" onClick={addPhase}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add structural change
        </Button>
      ) : (
        <div className="space-y-4">
          {phases.map((phase) => {
            const overrides = phase.assumptionOverrides as Record<string, unknown>;
            return (
              <div
                key={phase.id}
                className="rounded-lg border border-[#E8E2D9] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <DraftTextField
                    value={phase.label}
                    onChange={(label) => updatePhase(phase.id, { label })}
                    className="font-medium min-w-[160px]"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 shrink-0 p-0 text-[var(--text-muted)] hover:text-red-600"
                    onClick={() => removePhase(phase.id)}
                    aria-label={`Remove ${phase.label}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-3 text-sm">
                  <label className="flex items-center gap-2 text-[#6B6560]">
                    From month
                    <DraftInlineNumber
                      value={phase.startMonth}
                      onChange={(v) => updatePhase(phase.id, { startMonth: Math.max(1, v) })}
                      className="w-16"
                      integer
                      min={1}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-[#6B6560]">
                    To month
                    <DraftInlineNumber
                      value={phase.endMonth}
                      onChange={(v) => updatePhase(phase.id, { endMonth: Math.max(1, v) })}
                      className="w-16"
                      integer
                      min={1}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-[#6B6560]">
                    Reformers
                    <DraftInlineNumber
                      value={Number(overrides.reformers ?? a.reformers)}
                      onChange={(v) => updatePhaseOverride(phase.id, "reformers", v)}
                      className="w-16"
                      integer
                    />
                  </label>
                  <label className="flex items-center gap-2 text-[#6B6560]">
                    Classes/day
                    <DraftInlineNumber
                      value={Number(overrides.classesPerDay ?? a.classesPerDay)}
                      onChange={(v) => updatePhaseOverride(phase.id, "classesPerDay", v)}
                      className="w-16"
                      integer
                    />
                  </label>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-[#6B6560]">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(overrides.standingSpotEnabled ?? a.standingSpotEnabled)}
                      onChange={(e) =>
                        updatePhaseOverride(phase.id, "standingSpotEnabled", e.target.checked)
                      }
                    />
                    Standing Spot active
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(overrides.standbyEnabled ?? a.standbyEnabled)}
                      onChange={(e) =>
                        updatePhaseOverride(phase.id, "standbyEnabled", e.target.checked)
                      }
                    />
                    Standby active
                  </label>
                </div>
              </div>
            );
          })}

          <Button type="button" size="sm" variant="outline" onClick={addPhase}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add another phase
          </Button>
        </div>
      )}
    </>
  );
}

export function ForecastTimelineSection({
  searchQuery = "",
}: {
  searchQuery?: string;
}) {
  const { state, updateAssumptions } = useApp();
  const forecast = resolveForecastSettings(state.assumptions);
  const phases = forecast.forecastTimeline ?? [];

  return (
    <AssumptionSection
      title="Forecast structural changes"
      searchQuery={searchQuery}
      searchKeywords={[
        "reformers",
        "classes per day",
        "standing spot",
        "standby",
        "structural change",
        "forecast phase",
      ]}
      committed={{ forecastTimeline: phases }}
      onSave={(draft) =>
        updateAssumptions({
          forecastSettings: {
            ...forecast,
            forecastTimeline: draft.forecastTimeline,
          },
        })
      }
    >
      <ForecastTimelineBody />
    </AssumptionSection>
  );
}
