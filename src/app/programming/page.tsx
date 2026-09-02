"use client";

import { Plus, Trash2 } from "lucide-react";
import { useApp } from "@/lib/store/app-store";
import { SectionHeader, SampleBanner } from "@/components/shared/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CrudSelect } from "@/components/shared/crud-select";
import type { ProgrammingItem } from "@/lib/finance/schemas";

const CLASS_TYPES = ["Group", "Private", "Standing Spot", "Standby", "Other"] as const;
const STATUSES = ["Idea", "Testing", "Launch", "Live", "Archived"] as const;

function newProgrammingItem(partial?: Partial<ProgrammingItem>): ProgrammingItem {
  const now = new Date().toISOString();
  return {
    id: `prog-${Date.now()}`,
    name: partial?.name ?? "New class",
    classType: partial?.classType ?? "Group",
    level: partial?.level ?? "All levels",
    status: partial?.status ?? "Idea",
    credits: partial?.credits ?? 1,
    notes: partial?.notes,
    createdAt: now,
    updatedAt: now,
  };
}

export default function ProgrammingPage() {
  const { state, addProgrammingItem, updateProgrammingItem, deleteProgrammingItem } = useApp();

  const handleAdd = () => {
    addProgrammingItem(newProgrammingItem());
  };

  return (
    <div>
      <SectionHeader
        title="Programming"
        description="Class and product library — link products to the financial model."
        action={
          <Button type="button" size="sm" onClick={handleAdd}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add class
          </Button>
        }
      />
      <SampleBanner />

      {state.programmingItems.length === 0 ? (
        <div className="card-surface py-16 text-center">
          <p className="text-body text-[var(--text-secondary)]">No classes yet.</p>
          <Button type="button" className="mt-4" onClick={handleAdd}>
            Add your first class
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {state.programmingItems.map((item) => (
            <ProgrammingCard
              key={item.id}
              item={item}
              onUpdate={(updates) => updateProgrammingItem(item.id, updates)}
              onDelete={() => deleteProgrammingItem(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProgrammingCard({
  item,
  onUpdate,
  onDelete,
}: {
  item: ProgrammingItem;
  onUpdate: (updates: Partial<ProgrammingItem>) => void;
  onDelete: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-4">
        <Input
          value={item.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="max-w-md border-0 bg-transparent p-0 text-base font-medium shadow-none focus-visible:ring-0"
          aria-label="Class name"
        />
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{item.status}</Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-[var(--text-muted)] hover:text-red-600"
            aria-label={`Delete ${item.name}`}
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <CrudSelect
            value={item.classType}
            options={CLASS_TYPES}
            onChange={(classType) =>
              onUpdate({ classType: classType as ProgrammingItem["classType"] })
            }
            aria-label="Class type"
          />
          <Input
            value={item.level}
            onChange={(e) => onUpdate({ level: e.target.value })}
            className="max-w-[160px]"
            placeholder="Level"
            aria-label="Level"
          />
          <CrudSelect
            value={item.status}
            options={STATUSES}
            onChange={(status) =>
              onUpdate({ status: status as ProgrammingItem["status"] })
            }
            aria-label="Status"
          />
          <label className="flex items-center gap-2 text-[#6B6560]">
            Credits
            <Input
              type="number"
              min={0}
              value={item.credits}
              onChange={(e) => onUpdate({ credits: Number(e.target.value) || 0 })}
              className="w-16"
              aria-label="Credits"
            />
          </label>
        </div>
        <textarea
          className="w-full rounded-md border border-[var(--border-default)] p-2 text-body-sm"
          rows={2}
          placeholder="Notes — link to product, instructor requirements..."
          value={item.notes ?? ""}
          onChange={(e) => onUpdate({ notes: e.target.value })}
        />
      </CardContent>
    </Card>
  );
}
