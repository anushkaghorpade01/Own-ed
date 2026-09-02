# Access Products — Formula Registry

All formulas use `decimal.js` internally. Round only for display.

Central module: `src/lib/finance/engine/access-products.ts`

Supporting modules:
- `contribution.ts` — per-session contribution and expected flexible contribution
- `standing-spots.ts` — reservation capacity metrics
- `standby.ts` — Standby incremental economics

---

## Three types of certainty (not generic “predictability”)

| Type | Question |
|------|----------|
| Cash certainty | Has the customer already paid for the current product? |
| Class occupancy certainty | Do we know exactly which future classes this customer's demand belongs to? |
| Future-period revenue visibility | Is the customer contractually committed to future months? |

---

## Contribution per session

```
variableCostPerSeat = sessionConsumables + instructorPerAttendeePayout + (instructorPerClassPayout / maxGroupClassSize)
paymentFee = netRevenue × paymentGatewayPct
contributionPerSession = netRevenue − variableCostPerSeat − paymentFee
```

---

## Expected flexible contribution

```
expectedFlexibleContribution = contributionWhenOccupied × (fillProbability / 100)
```

Theoretical planning metric — **not** actual lost revenue.

---

## Flexible credit pack

```
nominalNetPerCredit = netPackageValue / creditsIncluded
expectedRedemptions = creditsIncluded × (expectedRedemptionRate / 100)
expectedExpiredCredits = creditsIncluded × (expectedBreakage / 100)
deferredUnearnedRevenue = netPackageValue × (1 − expectedRedemptionRate / 100)
contributionPerRedeemedCredit = contributionPerSession(nominalNetPerCredit)
```

Do not label pack revenue as recurring unless a recurring agreement exists.

---

## Standing Spot — capacity reservation

```
actualReservedSessionsInMonth = classesPerMonth (explicit or classesPerWeek × 52/12)
netRevenuePerReservedSession = committedMonthlyRevenue / actualReservedSessionsInMonth
reservedCapacity = actualReservedSessionsInMonth × reformersReservedPerClass
committedClassOccupancy = reformersReservedPerClass / classCapacity × 100
```

### Expected contributions

```
standingSpotContribution = contributionPerSession(netPerReservedSession) × attendanceProbability × sessionsPerMonth
expectedFlexibleContributionIfSameCapacity = contributionPerSession(comparableFlexibleNet) × fillProbability × sessionsPerMonth
capacityReservationValue = standingSpotContribution − expectedFlexibleContributionIfSameCapacity
```

### Economic neutral price

Solve net revenue per session where expected standing contribution equals expected flexible contribution for the slot (adjusted for attendance vs fill probability).

### Sensitivity table

Rows: flexible fill probability {40, 60, 80, 90, 100}%  
Columns: Standing Spot premium {0, 5, 10, 15, 20}%  
Cell: capacity reservation value at that combination

---

## Standby

```
expectedClaims = availableEmptySeats × (claimRate / 100)
standbyContribution = contributionPerSession(standbyNet) × attendedClaims
estimatedDisplacedRegularContribution = regularContribution × cannibalisationPct × expectedClaims
netIncrementalContribution = standbyContribution − estimatedDisplacedRegularContribution
breakEvenCannibalisationPct = (standbyContributionPerClaim / regularContributionPerSession) × 100
```

---

## Tests

`src/lib/finance/__tests__/access-products.test.ts`
