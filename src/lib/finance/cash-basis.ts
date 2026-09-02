/**
 * Operating cash inflow basis — prepaid pack purchase timing for flexible products.
 */
export const OPERATING_CASH_INFLOW_BASIS = {
  id: "prepaid_pack_purchase_cash",
  shortLabel: "Prepaid pack purchase cash (flexible + standing)",
  columnLabel: "Inflows (prepaid purchase basis)",
  explainer:
    "Flexible pack and standing subscription cash is modelled at purchase/billing timing — full customer price when sold. Net sales after GST is the planning revenue basis; redemption affects delivery costs and capacity, not the value of a non-refundable prepaid sale.",
  scenarioLabel: "Prepaid purchase cash (flexible + standing)",
  paybackCaveat:
    "Payback uses cumulative operating cash including upfront prepaid pack purchase cash.",
} as const;

export const PRICING_VERSIONING_NOTE =
  "Price and mix edits here update the live model immediately but do not create product version history. For versioned changes with audit trail, edit on Flexible Credits, Standing, or Standby pages.";
