import type { Product } from "./schemas";

/** Explicit sales-plan input labels — units the founder enters. */
export function getSalesPlanProductLabel(product: Product): string {
  if (product.type === "drop_in") return "Drop-in purchases";
  if (product.type === "private") return "Private sessions sold";
  if (product.type === "credit_pack") {
    const credits = product.creditsIncluded ?? 0;
    return `${credits}-credit packs sold`;
  }
  return `${product.name} sold`;
}
