"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store/app-store";
import { useFinanceModel } from "@/hooks/use-finance-model";
import { SectionHeader, SampleBanner } from "@/components/shared/metric-card";
import { formatINR } from "@/lib/format/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductEditorModal } from "@/components/access-products/product-editor-modal";
import { ChangePreviewModal } from "@/components/access-products/change-preview-modal";
import {
  getFlexibleCreditProducts,
  getProductById,
  previewProductChangeImpact,
  describeProductChange,
  isFinanciallyMeaningfulChange,
  isCosmeticProductChange,
} from "@/lib/finance/engine/product-catalog";
import { analyzeFlexiblePack, resolvePackRules } from "@/lib/finance/engine/flexible-packs";
import type { Product } from "@/lib/finance/schemas";

export default function FlexibleCreditsPage() {
  const router = useRouter();
  const {
    state,
    saveProduct,
    createProduct,
    duplicateProduct,
    archiveProduct,
    deleteProduct,
    activateProduct,
    createScenarioTestingProduct,
    getProductVersionHistory,
  } = useApp();
  const model = useFinanceModel();

  const [editing, setEditing] = useState<Product | null>(null);
  const [preview, setPreview] = useState<{
    lines: string[];
    impact: ReturnType<typeof previewProductChangeImpact>;
    product: Product;
    asDraft: boolean;
  } | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  const catalog = useMemo(
    () => getFlexibleCreditProducts(state.assumptions, { includeDraft: true }),
    [state.assumptions]
  );

  const economics = useMemo(() => {
    const map = new Map<string, ReturnType<typeof analyzeFlexiblePack>>();
    for (const p of catalog) {
      if (p.lifecycle === "active") {
        map.set(p.id, analyzeFlexiblePack(p, state.assumptions));
      }
    }
    return map;
  }, [catalog, state.assumptions]);

  function handleSaveRequest(product: Product, asDraft: boolean) {
    const existing = getProductById(state.assumptions, product.id);
    if (!existing || isCosmeticProductChange(existing, product)) {
      saveProduct(product, { asDraft, bumpVersion: !isCosmeticProductChange(existing ?? product, product) });
      setEditing(null);
      return;
    }
    if (isFinanciallyMeaningfulChange(existing, product)) {
      const impact = previewProductChangeImpact(state.assumptions, product.id, product);
      setPreview({
        lines: describeProductChange(existing, product),
        impact,
        product,
        asDraft,
      });
      setEditing(null);
      return;
    }
    saveProduct(product, { asDraft, bumpVersion: true });
    setEditing(null);
  }

  function confirmPreview() {
    if (!preview) return;
    saveProduct(preview.product, {
      asDraft: preview.asDraft,
      bumpVersion: true,
    });
    setPreview(null);
  }

  function handleTestInScenario(product: Product) {
    const scenarioId = createScenarioTestingProduct(
      product.id,
      product,
      `Test: ${product.name}`
    );
    router.push(`/math/scenarios?focus=${scenarioId}`);
  }

  return (
    <div>
      <SectionHeader
        title="Flexible Credits"
        description="Choose when you come. Edit products here — all finance modules read this configuration by product ID."
      />
      <SampleBanner />

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => {
            const id = createProduct();
            const p = getProductById(state.assumptions, id);
            if (p) setEditing(p);
          }}
        >
          + Add product
        </Button>
      </div>

      <div className="grid gap-4">
        {catalog.map((p) => {
          const rules = resolvePackRules(p);
          const econ = economics.get(p.id);
          const history = getProductVersionHistory(p.id);

          return (
            <Card key={p.id} className={p.lifecycle === "draft" ? "border-dashed" : ""}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle>{p.name.toUpperCase()}</CardTitle>
                    <Badge variant={p.lifecycle === "active" ? "default" : "secondary"}>
                      {p.lifecycle ?? "active"}
                    </Badge>
                    <span className="text-xs text-[#A39E98]">v{p.versionNumber ?? 1}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#A39E98]">{p.creditsIncluded} credits · {rules.validityValue} {rules.validityUnit}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button variant="outline" size="sm" onClick={() => setEditing(p)}>Edit</Button>
                  <Button variant="outline" size="sm" onClick={() => duplicateProduct(p.id)}>Duplicate</Button>
                  {p.lifecycle === "draft" && (
                    <Button variant="outline" size="sm" onClick={() => activateProduct(p.id)}>Activate</Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handleTestInScenario(p)}>Test in scenario</Button>
                  {p.lifecycle !== "archived" ? (
                    <Button variant="outline" size="sm" onClick={() => archiveProduct(p.id)}>Archive</Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => deleteProduct(p.id)}>Delete</Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <Cell label="Net pack price" value={econ ? formatINR(econ.netPackageValue) : "—"} />
                  <Cell label="Customer pays incl. GST" value={econ ? formatINR(econ.grossPrice) : "—"} />
                  <Cell label="Net price / credit" value={econ ? formatINR(econ.netPerCredit) : "—"} />
                  <Cell label="Validity" value={`${rules.validityValue} ${rules.validityUnit}`} />
                  {econ && (
                    <>
                      <Cell label="Expected usage" value={`${econ.expectedCreditsRedeemed.toFixed(1)} / ${econ.credits}`} />
                      <Cell label="Expected unused" value={econ.expectedCreditsUnused.toFixed(1)} />
                      <Cell label="Expected capacity consumed" value={`${econ.expectedReformerSessions.toFixed(1)} spots`} />
                      <Cell label="Expected delivery cost" value={formatINR(econ.expectedVariableCost)} />
                      <Cell label="Expected contribution" value={formatINR(econ.expectedContribution)} />
                      <Cell label="Contribution margin" value={`${econ.contributionMarginPct.toFixed(0)}%`} />
                    </>
                  )}
                </div>

                {history.length > 0 && (
                  <div className="mt-4">
                    <button
                      type="button"
                      className="text-xs text-[#6B6560] underline"
                      onClick={() => setExpandedHistory(expandedHistory === p.id ? null : p.id)}
                    >
                      Version history ({history.length})
                    </button>
                    {expandedHistory === p.id && (
                      <ul className="mt-2 space-y-1 text-xs text-[#6B6560]">
                        <li>
                          v{p.versionNumber ?? 1} (current) — ₹{p.price}, {p.creditsIncluded} credits, {rules.validityValue} {rules.validityUnit}
                        </li>
                        {[...history].reverse().map((v) => (
                          <li key={v.versionId}>
                            v{v.versionNumber} — ₹{v.product.price}, {v.product.creditsIncluded} credits,{" "}
                            {v.product.packRules?.validityValue ?? "?"} {v.product.packRules?.validityUnit ?? "weeks"} ·{" "}
                            {new Date(v.createdAt).toLocaleDateString()}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {catalog.length === 0 && (
        <p className="text-sm text-[#6B6560]">No flexible credit products. Add one to get started.</p>
      )}

      <p className="mt-6 text-xs text-[#A39E98]">
        Product mix trace:{" "}
        {model.accessProducts.flexiblePacks.map((p) => `${p.name} (${p.productId})`).join(" · ")}
      </p>

      {editing && (
        <ProductEditorModal
          product={editing}
          onClose={() => setEditing(null)}
          onSave={handleSaveRequest}
          onPreview={(p) => {
            const existing = getProductById(state.assumptions, p.id);
            if (existing) {
              setPreview({
                lines: describeProductChange(existing, p),
                impact: previewProductChangeImpact(state.assumptions, p.id, p),
                product: p,
                asDraft: p.lifecycle === "draft",
              });
            }
          }}
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

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[#A39E98]">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
