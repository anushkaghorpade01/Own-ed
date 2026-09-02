"use client";

import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useApp } from "@/lib/store/app-store";
import { DebouncedNumberInput } from "@/components/ui/debounced-input";
import { MetricLabel } from "@/components/ui/info-tooltip";
import { Button } from "@/components/ui/button";
import {
  calculateServiceDemandMixTotal,
  autoBalanceServiceDemandMix,
  listBaseCaseMixProducts,
  getServiceDemandPct,
  canRemoveFromServiceDemandMix,
  createServiceMixCreditPack,
  normalizeServiceDemandMixTo100,
  syncFlexiblePackageMixFromServiceDemand,
} from "@/lib/finance/engine/service-demand-mix";
import { productHasHistoricalUsage } from "@/lib/finance/engine/product-catalog";
import { SERVICE_DEMAND_MIX_TOOLTIP } from "@/lib/finance/sales-plan-copy";
import { cn } from "@/lib/cn";

export function ServiceDemandMixCard() {
  const { state, updateAssumptions } = useApp();
  const mix = useMemo(
    () => calculateServiceDemandMixTotal(state.assumptions),
    [state.assumptions]
  );

  const gap = mix.total.minus(100).toNumber();
  const products = listBaseCaseMixProducts(state.assumptions);

  const commitProducts = (products: typeof state.assumptions.products) => {
    updateAssumptions({
      products: syncFlexiblePackageMixFromServiceDemand(products),
    });
  };

  const updatePct = (productId: string, value: number) => {
    commitProducts(
      autoBalanceServiceDemandMix(
        state.assumptions.products,
        productId,
        Math.max(0, Math.min(100, value))
      )
    );
  };

  const handleAutoBalance = () => {
    if (products.length === 0) return;
    commitProducts(
      autoBalanceServiceDemandMix(
        state.assumptions.products,
        products[0].id,
        getServiceDemandPct(products[0])
      )
    );
  };

  const handleAddCreditPack = () => {
    const packCount = state.assumptions.products.filter(
      (p) => p.type === "credit_pack" && p.lifecycle !== "archived"
    ).length;
    const newPack = createServiceMixCreditPack(packCount);
    const withNew = [...state.assumptions.products, newPack];
    commitProducts(normalizeServiceDemandMixTo100(withNew));
  };

  const handleRemove = (productId: string) => {
    const product = state.assumptions.products.find((p) => p.id === productId);
    if (!product || !canRemoveFromServiceDemandMix(product, state.assumptions)) {
      return;
    }

    const nextProducts = productHasHistoricalUsage(productId, state)
      ? state.assumptions.products.map((p) =>
          p.id === productId ? { ...p, lifecycle: "archived" as const } : p
        )
      : state.assumptions.products.filter((p) => p.id !== productId);

    commitProducts(normalizeServiceDemandMixTo100(nextProducts));
  };

  return (
    <section className="card-surface">
      <MetricLabel
        label="Service demand mix"
        tooltip={SERVICE_DEMAND_MIX_TOOLTIP}
        tooltipLabel="Service demand mix"
        className="text-h2 block"
      />
      <p className="text-body-sm mt-1 text-[var(--text-secondary)]">
        Out of every 100 occupied reformer bookings, where do you expect demand to come from?
      </p>
      <p className="text-caption mt-2 text-[var(--text-muted)]">
        Standing Spot and Standby are optional strategies and are modelled separately.
      </p>

      <div className="mt-4 space-y-3">
        {products.map((p) => {
          const removable = canRemoveFromServiceDemandMix(p, state.assumptions);
          return (
            <div key={p.id} className="flex items-center gap-2">
              <label className="min-w-0 flex-1 text-body-sm font-medium">{p.name}</label>
              <DebouncedNumberInput
                className="w-20 shrink-0 text-right text-tabular"
                value={getServiceDemandPct(p)}
                onCommit={(v) => updatePct(p.id, v)}
              />
              <span className="text-caption w-6 shrink-0">%</span>
              {removable ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 shrink-0 p-0 text-[var(--text-muted)] hover:text-red-600"
                  aria-label={`Remove ${p.name} from mix`}
                  onClick={() => handleRemove(p.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : (
                <span className="h-8 w-8 shrink-0" aria-hidden />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3">
        <Button type="button" variant="outline" size="sm" onClick={handleAddCreditPack}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add credit pack
        </Button>
      </div>

      <div
        className={cn(
          "mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-body-sm",
          mix.valid ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"
        )}
      >
        <span>
          TOTAL {mix.total.toFixed(1)}%
          {!mix.valid && gap > 0 && ` — reduce by ${Math.abs(gap).toFixed(1)}%`}
          {!mix.valid && gap < 0 && ` — add ${Math.abs(gap).toFixed(1)}%`}
        </span>
        {!mix.valid && (
          <Button type="button" size="sm" variant="outline" onClick={handleAutoBalance}>
            Auto-balance
          </Button>
        )}
      </div>
    </section>
  );
}
