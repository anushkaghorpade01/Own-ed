# Own-ed Finance Model Documentation

> **Disclaimer:** Financial model outputs are planning tools and should be reviewed with the business's accountant before statutory or tax decisions are made.

## Architecture

All financial calculations flow through a **single calculation engine** at `src/lib/finance/`. UI components never implement their own formulas.

```
Assumptions → runFinanceModel() → Capacity, Revenue, Costs, P&L, Cash Flow, Break-even, Payback
```

All money calculations use **decimal.js** — never JavaScript floating-point arithmetic.

## Capacity

### Definition
Available seat capacity is the sum of scheduled class capacities over a period.

### Formula (planning mode fallback)
```
Weekly seats = reformers × classes/day × operating days/week
Monthly seats = weekly seats × 52/12
```

### Example
```
3 reformers × 5 classes/day × 6 days/week = 90 weekly seats
90 × 52/12 = 390 monthly seats
At 60% occupancy = 234 occupied seats
```

### Assumptions
- Uses 52/12 (4.333…) for weeks-per-month, never hardcoded 4
- Schedule records take precedence when `useScheduleForCapacity` is true

### Known limitations
- Calendar mode (actual operating days per month) is planned; planning mode uses 52/12

---

## Revenue

### GST Handling

**Inclusive entry:**
```
Net revenue = Gross price / (1 + GST rate)
```

Example: ₹2,000 incl. 18% GST → ₹1,694.92 net

**Exclusive entry:**
```
Net revenue = Entered price
GST = Net × GST rate
```

GST collected is **never** counted as studio revenue.

### Weighted Realised Revenue

```
Weighted net/credit = Σ (net revenue per credit × package mix %)
```

Package mix must equal 100%.

---

## Credit Accounting

Credits sold create a future service obligation.

Track separately:
- Credits sold (cash view)
- Credits redeemed (earned revenue view)
- Outstanding credits
- Coverage ratio = eligible capacity / expected redemptions

Label as **forecasting** — not certainty.

---

## Contribution

### Per occupied seat
```
Contribution = Net revenue/seat − payment fees − consumables − variable instructor cost
```

### Per class
Shown at 0/3, 1/3, 2/3, 3/3 occupancy levels.

Contribution margin ≠ fully loaded profit. Fixed overhead allocation is optional and separate.

---

## P&L (Accrual)

```
Net revenue = Gross billings − GST collected
Gross profit = Net revenue − direct costs
EBITDA = Gross profit − operating expenses
EBIT = EBITDA − depreciation
PBT = EBIT − interest
Net profit = PBT − tax
```

### Invariants (tested)
- Gross profit = Net revenue − direct costs
- EBITDA = Gross profit − operating expenses
- EBIT = EBITDA − D&A
- Net profit = PBT − tax

### Important exclusions
- Capex is NOT expensed through P&L
- Security deposits are NOT operating expenses
- Owner labour included by default (configurable)

---

## Cash Flow

Separate from P&L:
- Operating inflows/outflows
- Capital flows (capex, deposits)
- Financing flows (equity, loans)

```
Ending cash = Beginning cash + net cash flow
```

Includes 36-month runway with ramp-up occupancy curve.

---

## Break-even

Four distinct concepts:

1. **Contribution break-even occupancy** — fixed costs / contribution per seat / available seats
2. **EBITDA break-even** — occupancy where EBITDA = 0
3. **Cash break-even** — month when monthly operating cash flow ≥ 0
4. **Cumulative cash break-even** — month when cumulative cash ≥ 0

---

## Payback

Based on **cash flow**, not net profit.

```
Payback month = first month where cumulative free cash flow ≥ initial non-recoverable investment
```

Uses monthly ramp-up curve, not steady-state profit.

Recoverable security deposits excluded by default (configurable).

---

## Standing Spot (capacity reservation)

Standing Spot is modelled as a **capacity reservation product**, not simply prepaid revenue.

```
Committed monthly revenue = net monthly reservation price
Flexible inventory sacrificed = classes/month × reserved reformers per class
Remaining flexible seats per class = class size − reserved reformers per class
Committed occupancy (before flexible bookings) = reserved reformers / class size
Effective net revenue per reserved class = committed monthly revenue / classes per month
Premium vs credit pack = effective per-class revenue − weighted credit pack net per class
Monthly contracted cash = gross monthly price (recurring billing) or purchase-month cash (one-time)
Contracted future revenue = committed monthly revenue × (min commitment months − 1), only when a genuine subscription or minimum commitment exists
```

**Do not** describe Standing Spot revenue as inherently more "guaranteed" than cash already collected from prepaid credit packs. The economic trade-off is:

- **Member benefit:** certainty, routine, no booking competition
- **OWN benefit:** committed class-level occupancy; future revenue visibility only with recurring billing or minimum commitment
- **OWN cost:** reduced flexible inventory and opportunity cost on reserved seats

P&L allocates flexible credit revenue to `(occupied seats − committed Standing Spot seats) × weighted net per credit`, plus separate Standing Spot committed monthly revenue — avoiding double-counting reserved seats.

Warning if reserved reformers exceed configured max per class or total class size.

---

## Standby

Compare:
- Empty seat: ₹0 incremental
- Standby seat: net revenue − variable cost
- After cannibalisation: standby contribution − lost regular revenue × cannibalisation %

Never label profitable based on empty-seat scenario alone.

---

## Scenario Logic

Saved scenarios snapshot ALL assumptions. Live assumption changes do not affect saved scenarios unless explicitly updated.

---

## Depreciation

Straight-line (default):
```
Monthly depreciation = (cost − salvage) / useful life in months
```

Useful lives are user-configurable — not hardcoded to tax law.

---

## Rounding

- Full precision internally (decimal.js, 28 digit precision)
- Round only for display
- "Show calculation" exposes intermediate values

---

## Testing

Run: `npm test`

17+ unit tests covering GST, capacity, P&L invariants, package mix validation, and full model integration.
