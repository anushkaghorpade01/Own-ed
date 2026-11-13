# OWN operating model: implementation and verification notes

## Scope

An opt-in `OWN Operating Plan` is available at `/math/own-plan`. The existing finance mode remains intact until the toggle is enabled. Existing working capital, capex, expenses, loans and other financing assumptions are preserved.

Five product families are initially seeded: OWN Pilates (drop-in, 8, 16), OWN Complete (8 group Pilates + 4 group strength; 12 visits over two months; no drop-in), OWN Strength (8, 16), Private Pilates (8, 12) and Private Strength (8, 12). Eight-session packs last one month; 16-session packs and the 12-session products last two months. SKU names, prices, validity, expected sales, session composition and activity status are editable.

Six other revenue streams are editable, with 12 individual monthly sales quantity inputs and unit price/cost: space rentals, brand partnerships, externally hosted workshops, online sessions, OWN special workshops and corporate workshops.

The recurring weekly timetable supports group Pilates (5 reformers by default), group strength (6 attendees by default), private Pilates (exclusive use of reformer studio) and private strength (shared strength area). Pilates and strength each start with one instructor; headcount, salaries, session payouts and slots are editable. Two simultaneous sessions requiring the same trainer are flagged. Studio bookings deduct approximate area-hours, but cannot locate the precise time of a future rental without a dated booking.

Twelve calendar months have individually assigned peak/normal/off demand indices. The purchase forecast is based on package sales in the sale month; forecast physical usage is spread across validity using the editable utilisation rate. This deliberately avoids deferred-revenue accounting.

The monthly target solver calculates extra SKU units from the planned sales mix, and a member-acquisition requirement after churn, expected purchases by existing members, and expected new acquisitions. When the forecast mix is zero, it defaults to equal weights for active priced products. Monthly targets are also checked for timetable feasibility.

Three founding contribution rows are prefilled as labels, not funding amounts. More rows can be added or removed. Once OWN mode is on and the contributors have entered a positive total, it replaces *existing founder equity* for financing; it is not additional profit or a duplicated financing line. Existing working capital remains unchanged. An untouched zero contributor table preserves the old founder-equity funding amount.

## Integration

- `runFinanceModel`, the monthly P&L and revenue/direct costs use OWN's product sales and session demand when enabled.
- Monthly capacity and utilization use forecast service visits and timetable seats, not the old reformer-only bookings input.
- Trainer headcount and salary assumptions feed the operating-expense engine. With both OWN salary inputs unset, existing instructor payroll remains in place as a migration fallback.
- Scenario analysis carries the live OWN plan into existing scenarios and scales package demand in proportion to the scenario's occupancy assumption relative to the live base. The base case uses saved OWN values unchanged.
- The current-month break-even calculation is based on the sales mix needed for zero EBITDA at constant other revenue and operating costs, rather than the older single service/seat formula.
- The operating plan page shows central P&L EBITDA and net profit alongside the sales-based forecast. The overview and capacity pages also display OWN-specific service metrics when the plan is active.

## Validation and limits

Run `npm run test:own` for the dependency-free smoke and sensitivity checks. After installing dependencies with `npm ci`, run `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build` for complete application checks. **The latter commands could not be validated in the provided environment because npm package fetching failed.** The TypeScript source syntax was parsed independently, but this is not a substitute for full typechecking.

Known planning assumptions, not software defects:
- Member demand is a sales plan rather than a booking transaction ledger. Predicted membership acquisitions are *requirements*; they do not automatically constrain booked sales. The UI surfaces extra acquisition and schedule capacity required.
- Extra-revenue studio blockage is allocated proportionally across recurring classes, not an exact calendar conflict. Event-specific dated blocking would be a future scheduling enhancement.
- Salary split, product prices, opening members, actual timetable and forecast sales default to zero/unset, and must be entered before management can rely on the output.
- Scenarios use the existing occupancy factor as a **relative package-sales demand sensitivity** in OWN mode, not as an independently additive multiplier on top of OWN's seasonal indices.
