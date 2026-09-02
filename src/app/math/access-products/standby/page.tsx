"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { useApp } from "@/lib/store/app-store";
import { useFinanceModel } from "@/hooks/use-finance-model";
import { SectionHeader, SampleBanner } from "@/components/shared/metric-card";
import { formatINR } from "@/lib/format/currency";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductEditorModal } from "@/components/access-products/product-editor-modal";
import { ChangePreviewModal } from "@/components/access-products/change-preview-modal";
import { useProductSaveFlow } from "@/components/access-products/use-product-save-flow";

export default function StandbyPage() {
  const router = useRouter();
  const {
    state,
    saveProduct,
    duplicateProduct,
    archiveProduct,
    activateProduct,
    createScenarioTestingProduct,
    getProductVersionHistory,
  } = useApp();
  const model = useFinanceModel();
  const { editing, setEditing, preview, setPreview, handleSaveRequest, confirmPreview } =
    useProductSaveFlow(state.assumptions, saveProduct);

  const product = useMemo(
    () => state.assumptions.products.find((p) => p.type === "standby"),
    [state.assumptions.products]
  );
  const standby = model.accessProducts.standby;

  if (!product || !standby) {
    return (
      <div>
        <SectionHeader title="Standby" description="No Standby product configured." />
      </div>
    );
  }

  function handleTestInScenario() {
    const scenarioId = createScenarioTestingProduct(
      product!.id,
      product!,
      `Test: ${product!.name}`
    );
    router.push(`/math/scenarios?focus=${scenarioId}`);
  }

  const history = getProductVersionHistory(product.id);

  return (
    <div>
      <SectionHeader
        title="Standby"
        description="Come when there's room. Edit price, release window, and cannibalisation here — all downstream models update automatically."
      />
      <SampleBanner />

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">{product.name.toUpperCase()}</CardTitle>
            <p className="mt-1 text-sm text-[#6B6560]">
              {formatINR(new Decimal(product.price))}/claim ·{" "}
              {product.standbyReleaseHoursBefore ?? 3}h release window ·{" "}
              {product.standbyCannibalisationPct ?? 30}% cannibalisation
            </p>
          </div>
          <Badge variant="outline">{product.lifecycle ?? "active"}</Badge>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(structuredClone(product))}>
              Edit
            </Button>
            <Button size="sm" variant="outline" onClick={() => duplicateProduct(product.id)}>
              Duplicate
            </Button>
            {product.lifecycle === "draft" ? (
              <Button size="sm" variant="outline" onClick={() => activateProduct(product.id)}>
                Activate
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => archiveProduct(product.id)}>
                Archive
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleTestInScenario}>
              Test in scenario
            </Button>
          </div>
          {history.length > 0 && (
            <div className="mt-4 text-xs text-[#6B6560]">
              <p className="font-medium text-[#A39E98]">Version history</p>
              {history.map((v) => (
                <p key={v.versionId}>
                  v{v.versionNumber}: {formatINR(new Decimal(v.product.price))} ·{" "}
                  {v.product.standbyCannibalisationPct ?? 30}% cannibalisation ·{" "}
                  {new Date(v.createdAt).toLocaleDateString()}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <Metric
          label="Break-even cannibalisation"
          value={`${standby.breakEvenCannibalisationPct.toFixed(0)}%`}
        />
        <Metric
          label="Incremental contribution (est.)"
          value={formatINR(standby.financialOutputs.netIncrementalContribution)}
        />
      </div>
      <p className="mt-4 text-sm text-[#6B6560]">{standby.breakEvenExplanation}</p>

      {editing && (
        <ProductEditorModal
          product={editing}
          onClose={() => setEditing(null)}
          onSave={handleSaveRequest}
        />
      )}
      {preview && (
        <ChangePreviewModal
          changeLines={preview.lines}
          impact={preview.impact}
          onConfirm={confirmPreview}
          onCancel={() => setPreview(null)}
        />
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E8E2D9] bg-white p-4">
      <p className="text-xs text-[#A39E98]">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
