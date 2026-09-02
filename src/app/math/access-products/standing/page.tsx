"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { useApp } from "@/lib/store/app-store";
import { useFinanceModel } from "@/hooks/use-finance-model";
import { calculateAccessProducts } from "@/lib/finance/engine/access-products";
import { SectionHeader, SampleBanner } from "@/components/shared/metric-card";
import { formatINR } from "@/lib/format/currency";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductEditorModal } from "@/components/access-products/product-editor-modal";
import { ChangePreviewModal } from "@/components/access-products/change-preview-modal";
import { useProductSaveFlow } from "@/components/access-products/use-product-save-flow";

export default function StandingSpotsPage() {
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
  const [customPremium, setCustomPremium] = useState(0);
  const model = useFinanceModel();
  const { editing, setEditing, preview, setPreview, handleSaveRequest, confirmPreview } =
    useProductSaveFlow(state.assumptions, saveProduct);

  const product = useMemo(
    () => state.assumptions.products.find((p) => p.type === "standing_spot"),
    [state.assumptions.products]
  );

  const ap = useMemo(
    () => calculateAccessProducts(state.assumptions, model.capacity, customPremium),
    [state.assumptions, model.capacity, customPremium]
  );
  const ss = ap.standingSpot;

  if (!product || !ss) {
    return (
      <div>
        <SectionHeader title="Standing Spots" description="No Standing Spot product configured." />
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
        title="Standing Spots"
        description="Know when you come. Edit configuration here — capacity and P&L read this product by ID."
      />
      <SampleBanner />

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">{product.name.toUpperCase()}</CardTitle>
            <p className="mt-1 text-sm text-[#6B6560]">
              {product.standingSpotClassesPerWeek ?? 2} classes/week ·{" "}
              {product.standingSpotRules?.defaultCommitmentMonths ?? 1}-month commitment ·{" "}
              {formatINR(new Decimal(product.price))}/mo
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
                  v{v.versionNumber}: {formatINR(new Decimal(v.product.price))}/mo ·{" "}
                  {v.product.standingSpotClassesPerWeek ?? 2} classes/wk ·{" "}
                  {new Date(v.createdAt).toLocaleDateString()}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mb-4 flex items-center gap-2 text-sm">
        <span className="text-[#6B6560]">Premium sensitivity:</span>
        <input
          type="range"
          min={-20}
          max={40}
          value={customPremium}
          onChange={(e) => setCustomPremium(Number(e.target.value))}
        />
        <span>{customPremium > 0 ? "+" : ""}{customPremium}%</span>
      </div>

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <Metric label="Net sales / reserved session" value={formatINR(ss.financialOutputs.netRevenuePerReservedSession as Decimal)} />
        <Metric label="Capacity reservation value" value={formatINR(ss.financialOutputs.capacityReservationValue as Decimal)} />
        <Metric label="Economic neutral price" value={formatINR(ss.economicNeutralGrossMonthlyPrice)} />
        <Metric label="Future contracted revenue" value={formatINR(ss.financialOutputs.futureContractedRevenue as Decimal)} />
      </div>

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
