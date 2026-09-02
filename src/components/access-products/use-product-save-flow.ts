"use client";

import { useState } from "react";
import type { Product } from "@/lib/finance/schemas";
import {
  getProductById,
  previewProductChangeImpact,
  describeProductChange,
  isFinanciallyMeaningfulChange,
  isCosmeticProductChange,
} from "@/lib/finance/engine/product-catalog";
import type { FinanceAssumptions } from "@/lib/finance/schemas";

export function useProductSaveFlow(
  assumptions: FinanceAssumptions,
  saveProduct: (product: Product, options?: { asDraft?: boolean; bumpVersion?: boolean }) => void
) {
  const [editing, setEditing] = useState<Product | null>(null);
  const [preview, setPreview] = useState<{
    lines: string[];
    impact: ReturnType<typeof previewProductChangeImpact>;
    product: Product;
    asDraft: boolean;
  } | null>(null);

  function handleSaveRequest(product: Product, asDraft: boolean) {
    const existing = getProductById(assumptions, product.id);
    if (!existing || isCosmeticProductChange(existing, product)) {
      saveProduct(product, {
        asDraft,
        bumpVersion: existing ? !isCosmeticProductChange(existing, product) : false,
      });
      setEditing(null);
      return;
    }
    if (isFinanciallyMeaningfulChange(existing, product)) {
      setPreview({
        lines: describeProductChange(existing, product),
        impact: previewProductChangeImpact(assumptions, product.id, product),
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
    saveProduct(preview.product, { asDraft: preview.asDraft, bumpVersion: true });
    setPreview(null);
  }

  return {
    editing,
    setEditing,
    preview,
    setPreview,
    handleSaveRequest,
    confirmPreview,
  };
}
