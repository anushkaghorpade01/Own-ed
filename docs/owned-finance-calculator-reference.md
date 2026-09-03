# OWNED Finance Calculator Reference

> **Purpose:** Feed this document to Claude (or any LLM) to run what-if calculations for the OWNED reformer-studio financial model without the app UI.  
> **Source of truth in code:** `src/lib/finance/` — all paths relative to repo root.  
> **Currency:** INR unless stated otherwise.  
> **Precision:** Use exact decimal arithmetic in code; round only for display (typically 0–2 decimals for INR).

---

## 1. How Claude should use this document

1. **Assumptions are overridden on the fly.** Section 4 is a **template** (field names, units, valid ranges) plus one worked example. The user will change rent, occupancy, packs, pre-opening, etc. in the prompt — **always apply their overrides**; do not require the doc to match the app or a saved snapshot.
2. **Default when silent:** If the user gives no overrides, use Section 4 sample values and Section 3 baseline outputs as sanity checks.
3. **Apply formulas** in Section 5–12 in dependency order (capacity → revenue → costs → P&L → cash).
4. **Respect conventions** in Section 2.3 — especially booked vs attended, pack revenue timing, and sales plan vs forecast separation.
5. **For full-model what-ifs**, patch only the fields the user mentions; recompute the full chain; do not invent parallel formulas.
6. **Label outputs:** “steady-state monthly” vs “Month X forecast” vs “sales plan what-if” — they differ (Section 2.4).
7. **Echo assumptions used** at the start of each answer (especially overrides) so the user can spot-check.

### 1.1 Advisor role (business partner, finance, CA lens)

When the user asks *how something works*, *is the logic right*, or *what am I missing* — do **not** only compute numbers. Also:

| Mode | What to do |
|------|------------|
| **Explain** | Plain-language answer first, then formula if helpful. Use studio examples (reformers, packs, rent). |
| **What-if** | Patch assumptions → recompute → compare to baseline (Section 3) → state which profit view (Section 2.4). |
| **Validate logic** | Check whether the user's mental model matches Section 2.3 conventions; flag mismatches before calculating. |
| **Challenge / gap-find** | Use Section 26 checklist; say what is **not** in the model (Section 22) before recommending action. |
| **CA / statutory** | Clearly label **planning model** vs **statutory / audit / tax filing** (Section 25). Never present planning net profit as filed accounts. |

**Always:**
- Separate **profit**, **cash**, and **payback** — they answer different questions (Section 2.3, Section 24).
- Flag **theoretical** metrics (unused capacity opportunity, credit coverage stress test) — do not add them to P&L or payback.
- Ask **1–2 clarifying questions** when the user mixes layers (forecast vs sales plan vs steady-state) or omits critical inputs (occupancy, month number, pre-opening).
- When recommending a decision, state **assumptions relied on** and **what would falsify** the conclusion.

**Never:**
- Invent revenue recognition rules different from this doc without saying so.
- Treat empty reformers as "lost revenue" for prepaid packs already sold.
- Compare Month 8 forecast to steady-state P&L without explaining the occupancy gap.
- Give binding tax or legal advice — frame as "discuss with your CA" (Section 25).

**Orchestration entry point (code):**

```
runFinanceModel(assumptions) → capacity, revenue, directCosts, operatingExpenses, pl,
  unitEconomics, creditLiability, cashFlow, breakEven, payback, monthlyProjection, yearlyPL
```

---

## 2. Business context

### 2.1 What this business is

- Boutique **reformer pilates / group + private** studio (sample: 3 reformers, group class size 3).
- Revenue from **access products:** Drop-in, credit packs (8, 16), private sessions, optional duo/workshop/other.
- **Prepaid packs** are central: customer pays upfront; credits redeemed over validity window.
- Planning for **pre-opening** India studio: rent, fit-out capex, ramp-up occupancy, founder funding.

### 2.2 Product types

| Type | ID (sample) | Credits | Revenue timing (planning) |
|------|-------------|---------|---------------------------|
| Drop-in | `drop-in` | 1 | Net sales at purchase |
| 8-pack | `8-pack` | 8 | Full pack net at purchase |
| 16-pack | `16-pack` | 16 | Full pack net at purchase |
| Private | `private-session` | session | Per session (demand mix) |
| Standing Spot | optional | reservation | Separate module (disabled in sample) |
| Standby | optional | last-minute | Incremental contribution (disabled in sample) |

### 2.3 Critical planning conventions

**Booked vs attended occupancy**

- **Booked occupancy** → drives **revenue** (spots reserved / expected sales).
- **Attended occupancy** → drives **variable direct costs** (consumables, per-attendee instructor).
- Formula: `attendedSeats = monthlyAvailableSeats × attendedOccupancyPct`.

**Prepaid pack revenue (founder planning model)**

- **Net sales count at pack purchase**, NOT per redemption.
- A no-show or empty reformer does **NOT** reverse pack revenue already sold.
- **Breakage** (credits expire unused) → lower delivery costs, **not** lower net sales.
- **Incremental revenue** on a quiet day requires a **new** sale (drop-in, new pack) — not the same pack buyer showing up.

**Three related but separate layers**

| Layer | Question | Changes forecast? |
|-------|----------|-------------------|
| **Service demand mix** | Where do occupied *bookings* come from? (Drop-in / 8 / 16 / Private %) | Yes — drives P&L, capacity |
| **Sales plan** (Sales & Client Target) | What if I sell X drop-ins, Y packs this month? | No — isolated what-if on commercial layer |
| **Month X forecast profit** | What does ramp month M look like? | Yes — from `monthlyProjection[M]` |

**GST**

- `product.price` = **net sales ex-GST** (pricing semantics v2).
- Customer gross = `net × (1 + gstRatePct/100)` when GST registered.
- GST collected is **never** studio revenue.

**Cash vs P&L**

- **P&L (steady-state):** representative month at **target booked occupancy**.
- **Cash flow:** includes launch capex timing, pre-opening rent, prepaid pack **purchase** cash, bank balance.
- **Payback:** cumulative **operating cash generated** vs payback investment base — not net profit.

### 2.4 Profit views (do not conflate)

| View | Meaning |
|------|---------|
| **Steady-state monthly P&L** | Target occupancy month — `runFinanceModel().pl` |
| **Month X forecast profit** | Ramp + escalations for calendar month X — `monthlyProjection[X-1].pl.netProfit` |
| **Planning net profit from sales plan** | User-entered quantities — `calculatePlanningNetProfitFromSales` |
| **Yearly P&L** | Sum of monthly projection operating years (1–12, 13–24, …) |

---

## 3. Baseline computed outputs (sample assumptions)

Computed from `createSampleAssumptions()` + `runFinanceModel()` as of model in repo.

### 3.1 Steady-state monthly (target 60% booked)

| Metric | Value (INR) |
|--------|-------------|
| Net revenue | 473,948 |
| Direct costs | 17,620 |
| Gross profit | 456,327 |
| Operating expenses | 281,500 |
| EBITDA | 174,827 |
| Depreciation | 4,762 |
| **Net profit** | **127,549** |

### 3.2 Capacity (sample)

| Metric | Value |
|--------|-------|
| Weekly available seats | 90 (= 3 reformers × 5 classes/day × 6 days) |
| Monthly available seats | 390 (= weekly × 52/12) |
| Occupied seats (60% booked) | 234 |
| Attended seats (55% attended) | 214.5 |

### 3.3 Weighted unit economics

| Metric | Value (INR) |
|--------|-------------|
| Group weighted net / occupied spot | 1,441 |
| Blended net / occupied spot (incl. private) | 1,825 |
| Contribution margin / seat | 1,758 |
| Contribution break-even occupancy | 30.0% |
| EBITDA break-even occupancy | 41.1% |

### 3.4 Per-product net per credit/session (list prices)

| Product | Net price | Net / credit |
|---------|-----------|--------------|
| Drop-in | 1,695 | 1,695 |
| 8-pack | 11,525 | 1,440.63 |
| 16-pack | 21,695 | 1,355.94 |
| Private | 4,000 | 4,000 / session |

### 3.5 Launch & cash (sample)

| Metric | Value (INR) |
|--------|-------------|
| Non-recoverable capex | 2,335,000 |
| Working capital (in payback base) | 200,000 |
| Payback investment base | 2,535,000 |
| Security deposit | 300,000 |
| Total cash required at launch | 2,835,000 |
| Founder equity | 3,250,000 |
| Opening bank cash after month-1 payments | 2,550,000 |
| Lowest bank cash (month 4) | 555,533 |
| Payback month (cumulative operating cash) | 26 |
| Pre-opening months | 2 (classes start month 3) |
| Month 8 forecast profit | 42,280 |
| Month 3 forecast profit (first operating month) | -38,370 |

---

## 4. Assumption template + sample baseline

**You do not need to keep this section in sync with the app.** It lists every assumption field the model accepts, with sample values for structure reference. The user will specify changes in conversation (e.g. “rent 120k, occupancy 50%, 4 reformers”) — treat those as authoritative for that question.

Source shape: `src/lib/finance/sample-data.ts` → `createSampleAssumptions()`.

### 4.1 Studio & capacity

```
reformers = 3
maxGroupClassSize = 3
classesPerDay = 5
operatingDaysPerWeek = 6
weeksClosedPerYear = 2
useScheduleForCapacity = false
```

### 4.2 Occupancy

```
projectedBookedOccupancyPct = 60      # target / revenue driver
projectedAttendedOccupancyPct = 55    # delivery cost driver
peakOccupancyPct = 75
offPeakOccupancyPct = 45
cancellationRatePct = 5
noShowRatePct = 3
```

### 4.3 Service demand mix (% of occupied bookings — must sum to 100)

```
drop-in:     serviceDemandPct = 10
8-pack:      serviceDemandPct = 45
16-pack:     serviceDemandPct = 30
private:     serviceDemandPct = 15
```

### 4.4 Product prices (net ex-GST)

```
drop-in:     price = 1695,  credits = 1
8-pack:      price = 11525, credits = 8,  validity = 8 weeks
16-pack:     price = 21695, credits = 16, validity = 12 weeks
private:     price = 4000,  duration = 55 min
```

Pack rules (sample): redemption ~88–90%, breakage ~10–12%, no-show 3%, cancellation 5%.

### 4.5 Ancillary revenue (monthly)

```
privateSessionsPerMonth = 20        # also in demand mix
duoSessionsPerMonth = 10
duoPricePerPerson = 2100
duoAvgPeople = 2
workshopCountPerMonth = 2
workshopPrice = 2500
otherRevenuePerMonth = 0
```

### 4.6 Operating expenses (monthly INR)

```
rent = 90000
camMaintenance = 10000
ownerInstructorSalary = 60000       # included in opex (includeOwnerMarketRateComp = true)
additionalInstructorSalary = 0
cleanerSalary = 15000
receptionSalary = 0
security = 5000
internet = 2000
softwareSubscriptions = 8000
accounting = 5000
insurance = 4000
fixedMarketingRetainer = 10000
licences = 2000
otherFixedCosts = 5000
electricityBase = 8000
electricityVariablePerClass = 50
laundry = 6000
water = 2000
cleaningSupplies = 3000
sessionConsumables = 30             # per attended seat
refreshments = 5000
customerAcquisitionSpend = 15000
repairsReserve = 3000
miscVariableCosts = 2000
paymentGatewayPct = 2
instructorPerClassPayout = 0
instructorPerAttendeePayout = 0
```

### 4.7 Setup investment (capex, INR one-off)

```
capexInteriorFitout = 800000
capexReformers = 450000
capexSmallEquipment = 80000
capexMirrors = 60000
capexFlooring = 120000
capexLighting = 50000
capexHvac = 80000
capexSoundSystem = 30000
capexFurniture = 100000
capexReception = 50000
capexChangingRoom = 40000
capexBathroom = 30000
capexSignage = 25000
capexWebsite = 50000
capexProfessionalFees = 75000
capexLicensingSetup = 25000
capexLaunchMarketing = 100000
capexInitialConsumables = 20000
capexContingency = 150000
securityDepositAmount = 300000      # recoverable
workingCapital = 200000             # funded, retained in bank
```

### 4.8 Financing & tax

```
founderEquity = 3250000
loanAmount = 0
loanInterestRatePct = 12
loanTermMonths = 60
incomeTaxRatePct = 25
gstRegistered = true
gstRatePct = 18
```

### 4.9 Ramp-up & pre-opening

```
preOpeningMonths = 2
preOpeningOpexMode = "minimal"        # rent + CAM + base power only
rampUpMode = "interpolate"
rampUpStartingOccupancyPct = 30       # first *operating* month
rampUpMonthsToTarget = 12
rampUpTargetOccupancyPct = 60         # synced to projectedBookedOccupancyPct
forecastYears = 5
```

### 4.10 Credit liability (planning)

```
creditsSoldOutstanding = 146
creditsExpectedRedemptionBeforeExpiry = 128
creditsExpectedToExpireUnused = 18
```

### 4.11 Sales target preferences

```
targetMonthlyNetProfit = 200000
targetMonth = 8
targetMonthlyNetSales = 0             # 0 → use steady-state P&L net sales
capacityTightThresholdPct = 85
```

---

## 5. Capacity calculator

**Module:** `engine/capacity.ts`

### Planning mode (default)

```
weeklyAvailableSeats = reformers × classesPerDay × operatingDaysPerWeek
weeklyClasses = classesPerDay × operatingDaysPerWeek
monthlyAvailableSeats = weeklyAvailableSeats × (52/12)
usableOperatingWeeksPerYear = 52 − weeksClosedPerYear
annualAvailableSeats = weeklyAvailableSeats × usableOperatingWeeksPerYear

occupiedSeatsMonthly = monthlyAvailableSeats × (projectedBookedOccupancyPct / 100)
attendedSeatsMonthly = monthlyAvailableSeats × (projectedAttendedOccupancyPct / 100)
```

**Sample check:** 3×5×6 = 90 weekly; 90×52/12 = 390 monthly; ×60% = 234 occupied.

Schedule mode: if `useScheduleForCapacity` and schedule entries exist, sum scheduled class capacities instead.

---

## 6. Revenue calculator

**Module:** `engine/revenue.ts`, `service-booking-economics.ts`, `product-pricing.ts`

### Product net price

```
netPrice = product.price × (1 − discountPct/100)
grossPrice = netPrice × (1 + gstRatePct/100)   [if GST registered]
netPerCredit = netPrice / creditsIncluded     [packs & drop-in]
```

### Service demand mix → occupied bookings

For each product in base-case mix (drop-in, packs, private):

```
occupiedBookings_product = occupiedSeatsMonthly × (serviceDemandPct / 100)
```

Mix percentages must sum to 100%.

### Group class revenue

```
netSalesPerOccupiedBooking = net per credit (pack/drop-in) OR private net price
groupClassRevenue = Σ (occupiedBookings × netSalesPerOccupiedBooking)  [flexible products]
privateRevenue = from private sessions in mix + privateSessionsPerMonth path
```

### Weighted averages

```
weightedGroupNetSalesPerOccupiedSpot = Σ (mixPct × netPerBooking) / 100   [flexible only, renormalized]
blendedNetSalesPerOccupiedSpot = includes private in full mix
```

### Ancillary

```
duoRevenue = duoNetPerPerson × duoAvgPeople × duoSessionsPerMonth
workshopRevenue = workshopNet × workshopCountPerMonth
otherRevenue = otherRevenuePerMonth (net)
```

### Total

```
netRevenue = groupClass + standingSpot + standby + private + duo + workshop + other
gstCollected = netRevenue × gstRatePct/100   [if registered]
grossCustomerBillings = netRevenue + gstCollected
```

**Pre-opening months:** revenue = 0 (`createPreOpeningRevenueResult`).

---

## 7. Direct costs calculator

**Module:** `engine/costs.ts`, `contribution.ts`

```
variableInstructor = instructorPerClassPayout × classesPerMonth
                   + instructorPerAttendeePayout × attendedSeatsMonthly
                   + private session instructor costs

sessionConsumablesTotal = sessionConsumables × attendedSeatsMonthly
paymentFees = grossCustomerBillings × paymentGatewayPct/100 + fixed fees
directWorkshopCosts = (if applicable)

totalDirectCosts = variable instructor + consumables + payment fees + workshop direct
```

### Contribution per session/seat

```
variableCostPerAttendedSeat = sessionConsumables
                            + instructorPerAttendeePayout
                            + instructorPerClassPayout / maxGroupClassSize

paymentFee = netRevenue × paymentGatewayPct/100

contributionPerSession = netRevenuePerSession − variableCostPerAttendedSeat − paymentFee
```

---

## 8. Operating expenses calculator

**Module:** `engine/costs.ts`

```
utilities = electricityBase + electricityVariablePerClass × classesPerMonth

totalOperatingExpenses = rent + CAM + utilities + all salaries + security + internet
                       + software + accounting + insurance + marketing + licences
                       + laundry + water + supplies + refreshments + CAC + repairs
                       + miscVariable + custom expenses

totalFixedCosts = subset used for contribution break-even (excludes some variable lines)
```

### Pre-opening opex (`preOpeningMonths > 0`)

**Minimal mode:**

```
preOpeningOpex = rent + camMaintenance + electricityBase
```

**Full mode:** same as normal opex with zero classes.

---

## 9. P&L calculator (steady-state & monthly)

**Module:** `engine/pl.ts`, `monthly-projection.ts`

```
grossProfit = netRevenue − directCosts
EBITDA = grossProfit − operatingExpenses
depreciation = Σ straight_line:(purchaseValue − salvage) / usefulLifeMonths
EBIT = EBITDA − depreciation
interestExpense = loan payment interest portion
PBT = EBIT − interest
incomeTax = max(0, PBT × incomeTaxRatePct/100)
netProfit = PBT − incomeTax
```

Monthly projection: repeat per month with `getRampUpOccupancy(month)`, escalation (`applyMonthAssumptions`), structural timeline overrides.

---

## 10. Ramp-up & pre-opening

**Module:** `engine/cash-flow.ts`, `engine/pre-opening.ts`

### Pre-opening

```
If forecastMonth <= preOpeningMonths:
  occupancy = 0
  revenue = 0
  opex = preOpeningOpex
```

### Operating month index

```
operatingMonth = forecastMonth − preOpeningMonths   (0 during pre-opening)
firstOperatingMonth = preOpeningMonths + 1
```

### Interpolated ramp (default)

```
If operatingMonth >= rampUpMonthsToTarget:
  occupancy = projectedBookedOccupancyPct
Else:
  progress = (operatingMonth − 1) / (rampUpMonthsToTarget − 1)
  occupancy = start + (target − start) × progress
  where start = rampUpStartingOccupancyPct, target = projectedBookedOccupancyPct
```

### Capex cash timing (when preOpeningMonths > 0)

```
Month 1: security deposit
Months 1..preOpeningMonths: interior fit-out spread evenly
Month firstOperatingMonth: all other non-recoverable capex
When preOpeningMonths = 0: all capex in month 1 (legacy)
```

```
paybackInvestmentBase = nonRecoverableCapex + workingCapital [+ deposit if toggled]
totalCashRequiredAtLaunch = nonRecoverableCapex + deposit + workingCapital
openingBankCash = founderEquity + loan − cashPaidInMonth1
```

---

## 11. Cash flow & payback

**Module:** `engine/cash-flow.ts`, `prepaid-cash.ts`, `investment-recovery.ts`

### Operating cash (monthly)

```
cashInflows = prepaid pack gross purchases + ancillary earned-timing gross
cashOutflows = operatingExpenses + directCosts + gstCollected (planning convention)
netOperatingCashFlow = cashInflows − cashOutflows
```

### Bank cash

```
Month 1: openingBankAfterLaunch + netOperating − loan repayment
Month n: priorBank + fundingEvents + netOperating − scheduledCapex − loan repayment
```

### Recovery / payback

```
cumulativeOperatingCashGenerated = running sum of netOperatingCashFlow
recoveryPosition = cumulativeOperatingCashGenerated − paybackInvestmentBase
paybackMonth = first month where cumulative operating cash crosses payback base
```

**Note:** Operating inflow basis in sample = `prepaid_pack_purchase_cash`.

---

## 12. Break-even calculators

**Module:** `engine/break-even.ts`

### Contribution break-even occupancy

```
requiredOccupiedSeats = totalFixedCosts / contributionMarginPerSeat
breakEvenOccupancyPct = requiredOccupiedSeats / monthlyAvailableSeats × 100
```

### EBITDA break-even occupancy (linear approximation)

```
contributionAtFullCapacity = monthlyAvailableSeats × contributionPerSeat
ebitdaBreakEvenOccupancyPct = totalOperatingExpenses / contributionAtFullCapacity × 100
```

### Cash break-even

Month when `netOperatingCashFlow ≥ 0` (from cash flow engine).

---

## 13. Flexible pack economics

**Module:** `engine/flexible-packs.ts`

For each pack/drop-in product:

```
netPackageValue = product net price
netPerCredit = netPackageValue / creditsIncluded
expectedCreditsRedeemed = creditsIncluded × (expectedRedemptionRatePct / 100)
expectedCreditsExpired = creditsIncluded × (expectedBreakageRatePct / 100)
expectedVariableCost = expectedRedemptions × variable cost per redemption
expectedContribution = netPackageValue − expectedVariableCost
```

**Planning model:** full `netPackageValue` counts as net sales at purchase; deferred revenue = 0.

---

## 14. Credit liability & capacity coverage

**Module:** `engine/credit-health.ts`, `engine/credit-ledger.ts`

```
outstandingCredits = creditsSoldOutstanding (planning input)
expectedRedemptions = creditsExpectedRedemptionBeforeExpiry
expectedBreakage = creditsExpectedToExpireUnused
coverageRatio = eligibleCapacity / expectedRedemptions
```

Outstanding credits = future **delivery obligation**, not lost revenue.

---

## 15. Sales plan calculator (isolated what-if)

**Module:** `engine/sales-client-target.ts`  
**Does NOT change** service demand mix or Month X forecast (`sales-forecast-profit.test.ts`).

### Per-product commercial economics

```
netSalesPerSale = pack net price OR private net price
directCostPerSale = expected variable cost to deliver
contributionPerSale = netSalesPerSale − directCostPerSale
creditsPerSale = creditsIncluded (packs) OR 0 (private)
```

### Planning net profit from sales quantities

```
commercialNetSales = Σ (quantity × netSalesPerSale)
commercialDirectCosts = Σ (quantity × directCostPerSale)
→ feed into calculatePL with month opex → planningNetProfit
```

### Solvers

```
solveSalesForProfitTarget(assumptions, targetProfit, mode, targetMonth)
solveSalesForNetSalesTarget(assumptions, targetNetSales, mode, targetMonth)
```

Modes: `cheapest`, `fastest`, `balanced` (mix-weighted).

### Month X forecast profit

```
getMonthForecastProfit(assumptions, targetMonth) = monthlyProjection[targetMonth−1].pl.netProfit
```

### Substitution what-if (not yet a UI feature — manual)

To hold **contribution** constant when removing product A and adding product B:

```
Δqty_B = (qty_A × contributionPerSale_A) / contributionPerSale_B
```

Only **incremental** revenue if B is a **new** sale type; swapping pack redemptions does not add P&L net sales under purchase-timing convention.

---

## 16. Scenario & sensitivity analysis

**Module:** `engine/scenarios.ts`

- **No duplicate formulas** — calls `runFinanceModel()` per scenario.
- `compareScenarios(baseAssumptions, scenarioAssumptions[])` → metrics + diffs.
- `runOneVariableSensitivity(base, inputKey, outputKey, values[])` → sweeps one input.
- `calculateKeyDrivers(base)` → ranked EBITDA impact probes.

**Base case for analysis:** live saved assumptions (`state.assumptions`), not stale scenario snapshot.

Sensitivity inputs include: occupancy, realised revenue, rent, payroll, etc.  
Outputs: EBITDA, net profit, payback month, etc.

---

## 17. Optimise calculator

**Module:** `engine/optimisation.ts`

Answers: *What levers hit target profit?*

```
runOptimisationAnalysis(assumptions, objective, targetValue, lockedLevers)
```

Levers: occupancy, realised revenue, pack pricing, classes/day, reformers, fixed costs, staff, private/duo sessions, standing spot, standby, etc.

Each lever has status: `open` | `prefer_not` | `locked`.

Outputs: ranked single-lever moves, combination paths, bottleneck diagnosis.

---

## 18. Yearly P&L & escalation

**Module:** `engine/yearly-pl.ts`, `engine/escalation.ts`

```
forecastHorizonMonths = forecastYears × 12
Year Y sums months (Y−1)×12+1 .. Y×12 from monthlyProjection
```

Cost escalation rules apply from `firstEscalationMonth` with step intervals.  
Product price growth applies to catalog prices by month.

---

## 19. Unit economics & unused capacity

**Module:** `engine/unit-economics.ts`

```
contributionMarginPerSeat = weighted contribution / occupied seat logic
unusedCapacity = monthlyAvailableSeats − occupiedSeatsMonthly
unrealisedRevenueOpportunity = unusedCapacity × blendedNetSalesPerOccupiedSpot
```

**Important:** unrealised opportunity is **theoretical** — NOT double-counting prepaid pack revenue already sold.

---

## 20. What-if recipes for Claude

### Occupancy

```
Patch projectedBookedOccupancyPct (+ sync rampUpTargetOccupancyPct)
→ recompute capacity → revenue → P&L → break-even
```

### Price change

```
Patch product.price OR pack-specific
→ recompute netPerCredit, weighted revenue, contribution, break-even
```

### Rent increase

```
Patch rent → opex → EBITDA, cash flow, break-even occupancy (higher)
```

### Pre-opening length

```
Patch preOpeningMonths
→ zero revenue early months, spread fit-out cash, delay ramp, deepen bank trough
```

### “What if private goes to zero?”

```
Patch serviceDemandPct: private=0, rebalance others to 100%
Patch privateSessionsPerMonth = 0
→ recompute revenue, contribution mix
For sales-plan substitution: solve contribution-neutral quantities (Section 15)
```

### “Customer bought pack but no-shows”

```
Do NOT reduce net sales (already at purchase)
Reduce attendedOccupancyPct or increase noShowRatePct → lowers direct costs only
Empty spot incremental revenue requires new drop-in/pack sale
```

### Funding gap

```
If lowestBankCash < 0: fundingGap = |lowestBankCash|
minimumTotalFunding = totalPlannedFunding + fundingGap
```

---

## 21. Module index (code)

| Calculator | Primary file |
|------------|--------------|
| Full model | `run-model.ts` |
| Capacity | `engine/capacity.ts` |
| Revenue | `engine/revenue.ts` |
| Service mix | `engine/service-demand-mix.ts`, `service-booking-economics.ts` |
| Direct & opex costs | `engine/costs.ts` |
| P&L | `engine/pl.ts` |
| Contribution | `engine/contribution.ts` |
| Flexible packs | `engine/flexible-packs.ts` |
| Private economics | `engine/private-economics.ts` |
| Access products | `engine/access-products.ts` |
| Standing spot | `engine/standing-spots.ts` |
| Standby | `engine/standby.ts` |
| Cash flow | `engine/cash-flow.ts` |
| Prepaid cash | `engine/prepaid-cash.ts` |
| Launch / recovery | `engine/investment-recovery.ts` |
| Pre-opening | `engine/pre-opening.ts` |
| Break-even & payback | `engine/break-even.ts` |
| Unit economics | `engine/unit-economics.ts` |
| Credit health | `engine/credit-health.ts` |
| Monthly / yearly | `engine/monthly-projection.ts`, `engine/yearly-pl.ts` |
| Escalation | `engine/escalation.ts` |
| Sales target | `engine/sales-client-target.ts` |
| Scenarios | `engine/scenarios.ts` |
| Optimise | `engine/optimisation.ts` |
| Sample data | `sample-data.ts` |

---

## 22. Known limitations — what the model does NOT do

Use this when the user asks "am I missing something?" or "is this realistic?"

### 22.1 Structural / timing simplifications

| Topic | What the model does | What it does NOT do |
|-------|---------------------|---------------------|
| **Revenue recognition (P&L)** | Full pack net sales at **purchase** (founder planning convention) | Ind AS / GAAP deferred revenue over redemption period |
| **Cash vs P&L timing** | Prepaid pack **purchase cash** in operating cash flow; P&L net sales at purchase | Full earned-revenue cash matching; refund/chargeback flows |
| **Calendar capacity** | `52/12` weeks per month in planning mode | Actual days per calendar month (planned future enhancement) |
| **Schedule / peak slots** | Optional schedule mode; credit health uses simplified eligible-capacity check | Full booking-engine simulation; member time-preference optimisation |
| **Credit liability vs occupancy** | Conservative stress test: backlog vs uncommitted spots | Does not fully dedupe "occupied spots already include pack members" vs "backlog must also fit" — treat red/amber as "check peak schedule", not literal headcount shortfall |
| **Substitution solver** | Manual formula in Section 15 | No built-in UI for contribution-neutral product swap yet |
| **Refunds & chargebacks** | Not modelled | — |
| **Multi-location / franchise** | Single studio | — |
| **Inventory / retail merch** | `otherRevenuePerMonth` lump only | SKU-level COGS |
| **Payroll statutory** | Salaries as opex lines | PF, ESI, professional tax, gratuity accruals (unless user adds to opex) |
| **TDS / advance tax** | Optional flat `incomeTaxRatePct` on PBT | Quarterly advance tax cash timing, TDS on rent/professional fees |
| **GST compliance detail** | Net ex-GST pricing; GST collected shown | GSTR reconciliation, ITC on capex/opex, composition scheme |
| **Loan covenants / drawdowns** | Simple EMI schedule | Tranche draws, moratorium, covenants |
| **Inflation / indexation** | User-configured escalation rules | Automatic CPI linkage |
| **Competitor / market demand** | User-entered occupancy & sales volumes | Market sizing or elasticity (except via sensitivity sweeps) |

### 22.2 Interpretation boundaries

- **Planning net profit ≠ statutory net profit ≠ cash in bank.**
- **Break-even occupancy** = contribution threshold at current mix — not "minimum viable studio" including founder living costs unless salary is in opex.
- **Payback month** = cumulative **operating cash generated** vs payback base — not EBITDA payback, not including security deposit unless toggled.
- **Optimise / scenarios** explore levers within the model — they do not guarantee demand exists to fill new capacity.
- **Sales plan feasibility** checks capacity at aggregate level — peak-time slot constraints may still bind (redemption timing not fully modelled).

---

## 23. Common traps & misinterpretations

Claude should proactively correct these when detected in user questions.

### 23.1 "Empty reformer = lost money"

**Wrong for prepaid packs:** Revenue was at purchase. Empty spot = **unused capacity** or **lower delivery cost** (no-show), not reversed revenue.

**Right framing:** Incremental revenue on a quiet day needs a **new sale** (drop-in, new pack). Opportunity cost is **theoretical** (Section 19) unless you model incremental demand.

### 23.2 "Profit looks good so cash is fine"

Depreciation reduces profit but is not a monthly cash outflow. Capex, deposit, and pre-opening rent hit **cash** first. Pack sales can make **cash** look strong while **delivery obligation** (credits outstanding) grows.

**Check:** lowest bank cash month, funding gap, credit coverage — not P&L alone.

### 23.3 "Month 8 profit vs steady-state P&L — which is wrong?"

Neither — different questions. Month 8 uses **ramp occupancy + escalations** for that calendar month. Steady-state uses **target booked occupancy** as a mature representative month.

### 23.4 "Sales plan profit should match forecast"

**No.** Sales plan = user-entered quantities (isolated what-if). Forecast = service demand mix + ramp + all assumptions. Changing sales plan quantities does **not** change Month X forecast.

### 23.5 "Breakage = lost revenue"

In this planning model, expired unused credits → **lower expected delivery costs**, not lower net sales (unless refunds modelled separately).

### 23.6 "Founder teaches for free so economics are better"

If `includeOwnerMarketRateComp = false`, owner salary may be **excluded from EBITDA** while founder still works. Economic profit is **understated** on cost side. Advisor should ask: "Are you paying yourself market rate in the model?"

### 23.7 "Payback base vs total cash at launch"

Sample: payback base ≈ ₹25.35L (capex + WC); total cash at launch ≈ ₹28.35L including **₹3L security deposit** (recoverable, excluded from payback by default). Do not conflate.

### 23.8 "Weighted revenue per credit = what I earn per class"

Weighted metrics are **mix-weighted** by booking/credit volume, not average customer count. Private is handled separately in blended vs group-weighted views (Section 6).

### 23.9 "Credit coverage red = I'm oversold"

Treat as **conservative stress test**. Expected occupied spots may overlap the same members as the credit backlog. Action: verify **peak eligible slots** and pack sales pace — not panic on ratio alone.

---

## 24. Decision framework — which metric for which question

| User question | Primary metric | Secondary checks |
|---------------|----------------|------------------|
| Does the business work at maturity? | Steady-state **EBITDA / net profit** @ target occupancy | Contribution break-even vs target occupancy |
| Will I survive the first year? | **Lowest bank cash**, funding gap, month-by-month cash flow | Pre-opening months, ramp curve |
| When do I recover setup investment? | **Payback month** (operating cash cumulative) | Payback base composition (deposit in/out?) |
| Can I cover rent if occupancy dips? | **Contribution break-even occupancy** | EBITDA break-even, fixed cost stack |
| Am I selling too many packs? | **Credit coverage** (eligible, peak) | Expected redemptions vs uncommitted capacity |
| What must I sell to hit ₹X profit in Month 8? | **Sales plan solvers** + Month 8 forecast gap | Feasibility warning on capacity |
| Should I cut private / add drop-ins? | **Contribution per sale** by product; substitution (Section 15) | Service demand mix impact on forecast |
| Is rent increase affordable? | Δ **EBITDA**, new break-even occupancy | Cash trough if ramp unchanged |
| What's my best lever? | **Optimise / sensitivity** ranked drivers | Locked levers, demand realism |
| Am I pricing packs correctly? | **Net/credit**, pack contribution %, vs private/session | Cannibalisation (not auto-modelled) |
| Tax / entity structure? | **Not in model** — Section 26 | Refer to CA |

---

## 25. India / CA considerations (planning vs statutory)

Claude acts as a **planning advisor**, not a filing agent. When user asks CA-type questions:

### 25.1 What this model IS good for

- Founder scenario planning, pricing, occupancy targets, funding runway
- Comparing rent/staff/pack mix before opening
- Explaining **GST ex-GST pricing** logic to staff or partners
- Stress tests for board / investor conversations (label as projections)

### 25.2 What requires a qualified CA (flag explicitly)

| Area | Planning model | Statutory / real world |
|------|----------------|------------------------|
| **Revenue recognition** | Pack revenue at sale | May require deferral / performance obligations under Ind AS for companies |
| **GST** | Simple rate on net sales | Registration threshold, HSN/SAC, ITC on capex, reverse charge on rent (if applicable), filing |
| **Income tax** | Flat % on PBT | Slab rates, presumptive schemes, company vs LLP vs proprietorship, MAT, set-offs |
| **Depreciation** | User useful life, straight-line | Income Tax Act schedules (WDV), separate books |
| **TDS** | Not modelled | Rent (194-I), professional fees, salary |
| **Employee costs** | Gross salary lines | PF, ESI, bonus, leave encashment |
| **Lease accounting** | Rent as monthly opex | Ind AS 116 right-of-use for certain entities |
| **Pre-opening costs** | Spread fit-out cash; pre-opening opex | Capitalisation vs expensing per facts and entity |
| **Security deposit** | Recoverable asset in cash bridge | Not P&L; balance sheet treatment |

**Standard disclaimer line:** "This is a founder planning model in OWNED. For filing, audit, and entity-specific tax treatment, work with your CA with actual contracts and registration status."

### 25.3 Entity structure (discussion prompts only)

Claude may discuss trade-offs at high level if asked (proprietorship vs LLP vs Pvt Ltd: compliance cost, liability, investor readiness, salary vs dividend) but must **not** recommend a structure without CA/legal input.

---

## 26. Pressure-test checklist — "what am I missing?"

When user asks for a model review, walk through:

**Demand & revenue**
- [ ] Is target occupancy (`projectedBookedOccupancyPct`) supported by market/comp, or aspirational?
- [ ] Does service demand mix sum to 100% and match how you actually sell?
- [ ] Are pack `expectedSalesVolumePerMonth` in pack rules consistent with occupancy story?
- [ ] Private sessions: double-counted in mix AND `privateSessionsPerMonth`?

**Costs**
- [ ] Is founder market-rate comp included if founder teaches?
- [ ] Rent + CAM + deposit + fit-out match lease term and fit-out quotes?
- [ ] Marketing/CAC realistic for launch vs steady-state?
- [ ] Instructor model: salaried vs per-class/per-attendee — matches payroll plan?
- [ ] Escalation on rent/salaries applied from correct month?

**Cash & funding**
- [ ] `founderEquity + loan` covers **total cash at launch** + worst-month trough?
- [ ] Pre-opening months modelled if paying rent before classes?
- [ ] Working capital buffer adequate for prepaid-heavy model?
- [ ] Loan EMI starts when assumed?

**Capacity & packs**
- [ ] Credit outstanding / redemption assumptions updated as you sell?
- [ ] Peak-time eligibility for members — does schedule support it?
- [ ] Standing spot / standby — if enabled, inventory sacrifice understood?

**Profit views**
- [ ] Comparing the right view (steady vs Month X vs sales plan)?
- [ ] Month number includes pre-opening offset?

**External / not in model**
- [ ] Personal living expenses / founder draw separate from studio P&L?
- [ ] Contingency on capex and first-year opex?
- [ ] Insurance, licensing, fire NOC, music licenses — in opex/capex?
- [ ] Refund policy and breakage assumptions match terms & conditions?

---

## 27. Condensed glossary (OWNED terms)

| Term | Meaning | Not the same as |
|------|---------|-----------------|
| **Net sales (ex-GST)** | Founder price; studio revenue for planning | Customer pays incl. GST |
| **Booked occupancy** | % spots reserved → **revenue** driver | Attended occupancy |
| **Attended occupancy** | % spots delivered → **direct cost** driver | Booked occupancy |
| **CM1 / contribution per seat** | Net sales − variable costs per delivered seat | Fully loaded profit |
| **CM2 / gross profit** | Net sales − all direct costs (month) | EBITDA |
| **EBITDA** | After opex, before D&A, interest, tax | Cash flow |
| **Planning net profit** | After D&A, interest, tax in model | Statutory net profit |
| **Steady-state P&L** | Mature month at target occupancy | Any specific calendar month |
| **Month X forecast** | Ramp month X from `monthlyProjection` | Steady-state |
| **Sales plan profit** | From entered sale quantities | Forecast profit |
| **Unused capacity** | Unbooked spots | Financial loss (automatically) |
| **Unrealised revenue opportunity** | Theoretical if all spots filled at avg price | Lost revenue or incremental cash |
| **Payback base** | Non-recoverable capex + WC (+ deposit if toggled) | Total cash at launch |
| **Operating cash generated** | Cumulative monthly operating cash for payback | Net profit |
| **Breakage** | Credits expire unused | Revenue write-off (in this model) |
| **Service demand mix** | % of occupied bookings by product | Sales plan quantities |
| **Credit coverage** | Eligible capacity ÷ expected redemptions | Simple occupancy |

Full glossary in code: `src/lib/finance/finance-dictionary.ts`

---

## 28. Funding & runway logic

```
totalCashRequiredAtLaunch = nonRecoverableCapex + securityDeposit + workingCapital
totalPlannedFunding = founderEquity + loanAmount
openingBankCash = totalPlannedFunding − cashPaidInMonth1 (capex, deposit, pre-opening opex)

lowestBankCash = min(bankBalance over projection horizon)
fundingGap = max(0, −lowestBankCash)   # if bank goes negative
minimumTotalFunding = totalPlannedFunding + fundingGap
```

**Advisor notes:**
- Founder equity **funds** the bank; it does not reduce payback hurdle (except via faster recovery if operations improve).
- Security deposit is **cash out** at launch but **recoverable** — still needs funding even if excluded from payback base.
- Pre-opening extends zero-revenue months while rent (minimal or full) continues — deepens trough before first class.
- Compare **lowest bank cash month** to buffer needed for slow ramp or seasonal dip (not auto-modelled).

---

## 29. Regenerating baseline numbers

From repo root (requires Node):

```bash
npx tsx -e "
import { createSampleAssumptions } from './src/lib/finance/sample-data.ts';
import { runFinanceModel } from './src/lib/finance/run-model.ts';
const m = runFinanceModel(createSampleAssumptions());
console.log({ netProfit: m.pl.netProfit.toNumber(), payback: m.payback.paybackMonth });
"
```

Or run tests: `npm test`

---

## 30. Disclaimer

Financial model outputs are **planning tools**. Tax, statutory revenue recognition, and legal contract terms may differ. Review with a qualified accountant before decisions.

---

*Generated for OWNED / Own-ed. Sections 3–4 are illustrative. Sections 22–28 are for advisor/review mode with Claude. Recompute Section 3 after material engine changes.*
