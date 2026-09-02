"use client";

import { Plus, Trash2 } from "lucide-react";
import { useApp } from "@/lib/store/app-store";
import { SectionHeader } from "@/components/shared/metric-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CrudSelect } from "@/components/shared/crud-select";
import type { ProductConcept } from "@/lib/finance/schemas";

const PRIORITIES = ["MVP", "Later", "Nice to have"] as const;
const STATUSES = ["Idea", "Planned", "In progress", "Shipped", "Deprecated"] as const;

function newProductConcept(partial?: Partial<ProductConcept>): ProductConcept {
  const now = new Date().toISOString();
  return {
    id: `product-concept-${Date.now()}`,
    name: partial?.name ?? "New feature",
    problem: partial?.problem ?? "",
    priority: partial?.priority ?? "MVP",
    status: partial?.status ?? "Idea",
    notes: partial?.notes,
    createdAt: now,
    updatedAt: now,
  };
}

export default function ProductPage() {
  const { state, addProductConcept, updateProductConcept, deleteProductConcept } = useApp();

  const handleAdd = () => {
    addProductConcept(newProductConcept());
  };

  return (
    <div>
      <SectionHeader
        title="Product"
        description="OWN app/software concepts — planning only, not customer-facing tools."
        action={
          <Button type="button" size="sm" onClick={handleAdd}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add feature
          </Button>
        }
      />

      {state.productConcepts.length === 0 ? (
        <div className="card-surface py-16 text-center">
          <p className="text-body text-[var(--text-secondary)]">No product concepts yet.</p>
          <Button type="button" className="mt-4" onClick={handleAdd}>
            Add your first feature
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {state.productConcepts.map((feature) => (
            <ProductConceptCard
              key={feature.id}
              feature={feature}
              onUpdate={(updates) => updateProductConcept(feature.id, updates)}
              onDelete={() => deleteProductConcept(feature.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductConceptCard({
  feature,
  onUpdate,
  onDelete,
}: {
  feature: ProductConcept;
  onUpdate: (updates: Partial<ProductConcept>) => void;
  onDelete: () => void;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-3">
            <Input
              value={feature.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="font-medium"
              aria-label="Feature name"
            />
            <textarea
              className="w-full rounded-md border border-[var(--border-default)] p-2 text-body-sm"
              rows={2}
              placeholder="What problem does this solve?"
              value={feature.problem}
              onChange={(e) => onUpdate({ problem: e.target.value })}
            />
            <div className="flex flex-wrap items-center gap-2">
              <CrudSelect
                value={feature.priority}
                options={PRIORITIES}
                onChange={(priority) =>
                  onUpdate({ priority: priority as ProductConcept["priority"] })
                }
                aria-label="Priority"
              />
              <CrudSelect
                value={feature.status}
                options={STATUSES}
                onChange={(status) =>
                  onUpdate({ status: status as ProductConcept["status"] })
                }
                aria-label="Status"
              />
            </div>
            <textarea
              className="w-full rounded-md border border-[var(--border-default)] p-2 text-body-sm"
              rows={2}
              placeholder="Notes..."
              value={feature.notes ?? ""}
              onChange={(e) => onUpdate({ notes: e.target.value })}
            />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="text-xs text-[#A39E98]">
              {feature.priority} · {feature.status}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-[var(--text-muted)] hover:text-red-600"
              aria-label={`Delete ${feature.name}`}
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
