"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useApp } from "@/lib/store/app-store";
import { SectionHeader } from "@/components/shared/metric-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CrudSelect } from "@/components/shared/crud-select";
import { ROADMAP_PHASES, type RoadmapItem } from "@/lib/finance/schemas";
import { cn } from "@/lib/cn";

const STATUSES = ["Todo", "In progress", "Done", "Blocked"] as const;
const PRIORITIES = ["High", "Medium", "Low"] as const;

function newRoadmapItem(partial?: Partial<RoadmapItem>): RoadmapItem {
  const now = new Date().toISOString();
  return {
    id: `roadmap-${Date.now()}`,
    title: partial?.title ?? "New task",
    phase: partial?.phase ?? ROADMAP_PHASES[0],
    status: partial?.status ?? "Todo",
    priority: partial?.priority ?? "Medium",
    owner: partial?.owner,
    deadline: partial?.deadline,
    notes: partial?.notes,
    createdAt: now,
    updatedAt: now,
  };
}

export default function RoadmapPage() {
  const { state, addRoadmapItem, updateRoadmapItem, deleteRoadmapItem } = useApp();
  const [phaseFilter, setPhaseFilter] = useState<string | null>(null);

  const items = useMemo(() => {
    const sorted = [...state.roadmapItems].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    if (!phaseFilter) return sorted;
    return sorted.filter((item) => item.phase === phaseFilter);
  }, [state.roadmapItems, phaseFilter]);

  const handleAdd = () => {
    addRoadmapItem(newRoadmapItem({ phase: phaseFilter ?? ROADMAP_PHASES[0] }));
  };

  return (
    <div>
      <SectionHeader
        title="Roadmap"
        description="Project management — Kanban, timeline, list, and budget views."
        action={
          <Button type="button" size="sm" onClick={handleAdd}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add task
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPhaseFilter(null)}
          className={cn(!phaseFilter && "ring-2 ring-[var(--text-primary)] ring-offset-1")}
        >
          <Badge variant={phaseFilter ? "outline" : "secondary"}>All phases</Badge>
        </button>
        {ROADMAP_PHASES.map((phase) => (
          <button
            key={phase}
            type="button"
            onClick={() => setPhaseFilter(phaseFilter === phase ? null : phase)}
            className={cn(phaseFilter === phase && "ring-2 ring-[var(--text-primary)] ring-offset-1")}
          >
            <Badge variant={phaseFilter === phase ? "secondary" : "outline"}>{phase}</Badge>
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="card-surface py-16 text-center">
          <p className="text-body text-[var(--text-secondary)]">
            {phaseFilter ? `No tasks in ${phaseFilter}.` : "No roadmap tasks yet."}
          </p>
          <Button type="button" className="mt-4" onClick={handleAdd}>
            Add your first task
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <RoadmapCard
              key={item.id}
              item={item}
              onUpdate={(updates) => updateRoadmapItem(item.id, updates)}
              onDelete={() => deleteRoadmapItem(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RoadmapCard({
  item,
  onUpdate,
  onDelete,
}: {
  item: RoadmapItem;
  onUpdate: (updates: Partial<RoadmapItem>) => void;
  onDelete: () => void;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-3">
            <Input
              value={item.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              className="font-medium"
              aria-label="Task title"
            />
            <div className="flex flex-wrap items-center gap-2">
              <CrudSelect
                value={item.phase}
                options={ROADMAP_PHASES}
                onChange={(phase) => onUpdate({ phase })}
                aria-label="Phase"
              />
              <CrudSelect
                value={item.status}
                options={STATUSES}
                onChange={(status) =>
                  onUpdate({ status: status as RoadmapItem["status"] })
                }
                aria-label="Status"
              />
              <CrudSelect
                value={item.priority}
                options={PRIORITIES}
                onChange={(priority) =>
                  onUpdate({ priority: priority as RoadmapItem["priority"] })
                }
                aria-label="Priority"
              />
              <Input
                type="date"
                value={item.deadline?.slice(0, 10) ?? ""}
                onChange={(e) => onUpdate({ deadline: e.target.value || undefined })}
                className="w-auto text-body-sm"
                aria-label="Deadline"
              />
            </div>
            <textarea
              className="w-full rounded-md border border-[var(--border-default)] p-2 text-body-sm"
              rows={2}
              placeholder="Notes..."
              value={item.notes ?? ""}
              onChange={(e) => onUpdate({ notes: e.target.value })}
            />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Badge variant={item.priority === "High" ? "danger" : "outline"}>{item.priority}</Badge>
            <Badge variant="secondary">{item.status}</Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-[var(--text-muted)] hover:text-red-600"
              aria-label={`Delete ${item.title}`}
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
