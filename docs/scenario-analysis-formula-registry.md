# Scenario Analysis — Formula Registry

Scenario Analysis is an **orchestration layer only**. It calls `runFinanceModel()` from `run-model.ts` for every scenario, sensitivity cell, and driver probe.

Module: `src/lib/finance/engine/scenarios.ts`

---

## Principles

- Individual Math pages answer: *How does this part of the business work?*
- Scenario Analysis answers: *What happens to the entire business when assumptions change?*
- No duplicate P&L, capacity, Standing Spot, Standby, payback, or break-even formulas in this layer.

---

## Tests

`src/lib/finance/__tests__/scenario-analysis.test.ts`
