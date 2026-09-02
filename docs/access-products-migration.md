# Access Products Migration Report

**Date:** 2026-09-01  
**Supersedes:** 4 / 8 / 12 monthly-credit ladder  
**New architecture:** 1 / 8 / 16 quantity + validity packs + Standing Spot + Standby

---

## Summary table

| OLD ASSUMPTION | FILE / MODULE | CURRENT BEHAVIOUR | NEW ASSUMPTION | REQUIRED CHANGE | FINANCIAL IMPACT | CAPACITY IMPACT |
|---|---|---|---|---|---|---|
| 4/8/12 credit packs, 30/60/90 day validity | `sample-data.ts` | Fixed SKUs with `expectedMonthlyUsageCredits` | 1 / 8 / 16 credits, 4/8/12 **weeks** validity | **Done** — migrated products + `packRules` | Earned revenue timing follows redemption not monthly cadence | Redemption spread over validity window |
| 4-pack = ~1×/week implicit | `access-products.ts` (old blend) | Blended `analyzeFlexibleCreditPack` | Per-SKU `analyzeFlexiblePack` | **Done** — `flexible-packs.ts` | Removes false monthly frequency | Usage from redemption curves |
| 12-pack monthly allocation | `sample-data.ts` | 12 credits / 90 days | 16 Credit Pack / 12 weeks | **Done** — `16-pack` id | Price preserved proportionally (₹25,600) | — |
| 3×/week Standing, 3-mo min | `sample-data.ts`, `standing-spots.ts` | 13 classes/mo hardcoded | 2 slots/week, 1–2 mo commitment offered | **Done** — `standingSpotRules`, 1-mo base | Less future contracted revenue at launch | ~8.7 committed seats/mo (calendar) |
| Cash = revenue | `revenue.ts`, P&L | Occupancy-based earned revenue | Separate cash collected vs earned | **Partial** — pack economics split; P&L still occupancy-based | Deferred revenue visible per pack | — |
| Manual credit liability | `schemas.ts`, `unit-economics.ts` | `creditsSoldOutstanding` manual | Ledger from pack sales | **Done** — `credit-ledger.ts` + Credit Health | Outstanding derived from pack volume | Coverage vs eligible flexible capacity |
| `accessProductMix` decorative | `scenarios.ts`, `access-products.ts` | Does not drive P&L | Mix drives session allocation | **Partial** — mix UI + health; P&L integration pending | Scenario mix changes still limited | — |
| `expectedMonthlyUsageCredits` | `ProductSchema` | Display only | Deprecated | **Done** — marked deprecated; use redemption curves | — | — |
| Standby not in P&L | `revenue.ts` | Analysis only | Incremental contribution in access layer | **Unchanged** — by design until mix wired | — | Standby waterfall in `standby.ts` |
| Pricing UI 4/8/12 | `pricing/page.tsx` | Edits legacy products | Generic pack editor | **Partial** — Pack Designer added | — | — |

---

## Old logic removed

- Sample **4-pack** and **12-pack** products (auto-migrated via `product-migration.ts` on localStorage load)
- **`expectedMonthlyUsageCredits`** as primary usage model (deprecated on schema)
- Implicit **13 classes/month** Standing Spot (replaced with 2 classes/week × calendar weeks)
- Default **3-month** Standing commitment in base case (now **1 month** launch default; 2–3 mo still supported in engine)
- Blended-only flexible pack narrative (“once/twice/thrice per week” language)

---

## New data structures

- `FlexiblePackRulesSchema` — validity, activation, redemption, policies (`schemas.ts`)
- `StandingSpotRulesSchema` — recurring slots, commitment months offered, premium, release policy
- `VALIDITY_PRESETS` — tighter / base / generous scenario presets
- Engine: `flexible-packs.ts`, `credit-ledger.ts`, `credit-health.ts`, `product-migration.ts`

---

## New UI (Math → Access Products)

| Route | Purpose |
|---|---|
| `/math/access-products` | Overview + philosophy + full economics |
| `/math/access-products/flexible` | Per-pack economics |
| `/math/access-products/pack-designer` | Pack design + validity stress test + safe sales |
| `/math/access-products/standing` | Standing Spot summary |
| `/math/access-products/standby` | Standby summary |
| `/math/access-products/mix` | Product mix |
| `/math/access-products/credit-health` | Ledger, coverage, warnings |
| `/math/access-products/actuals` | Placeholder for assumed vs actual |

---

## Tests

- **73 passed**, 0 failed
- New: `flexible-packs.test.ts`
- Updated: `standing-spots.test.ts`, `engine.test.ts`, `access-products.test.ts`

---

## Still requiring founder decision

- **16-pack gross price** (₹25,600 is proportional estimate — confirm)
- **Pack sales volume** (`expectedSalesVolumePerMonth` on each pack)
- **Redemption / breakage / peak booking** assumptions per pack
- **Standing** slot occupancy forecasts per slot
- **Standby** cannibalisation and release window
- **When validity begins** (purchase vs activation) for each product
- **P&L recognition policy** for breakage (accountant confirmation)

---

## Remaining engineering (not in this pass)

- Wire `accessProductMix` into `calculateRevenue` / occupancy split
- Calendar-aware Standing Spot session count from `recurringSlots[]` (multi-slot)
- Google Sheets persistence for PackRules / CreditLedger / Cohorts
- Actuals cohort UI
- Full scenario sensitivity on pack validity presets
