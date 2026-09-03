export const OCCUPANCY_FIELD_TOOLTIPS = {
  booked: `Percentage of available reformer spots you expect to be booked (reserved), before cancellations and no-shows.

Affects: Revenue, Capacity, Payback, Break-even, P&L, Cash flow ramp-up, Optimise, and Scenarios. Also synced to Ramp-up → Target occupancy. During ramp, pack pre-sales can scale up separately (Assumptions → Pack pre-sales).`,

  attended: `Percentage of spots where customers actually show up — after cancellations and no-shows. Usually at or below booked occupancy.

Default: follows booked using cancellation and no-show rates (linked mode). During ramp, attended scales with that month's booked occupancy — not a fixed % of full capacity.

Affects: Attended seats on Capacity, variable direct costs (consumables). Revenue uses booked occupancy; delivery costs use attended.`,

  peak: `Expected occupancy during peak booking windows (e.g. evenings).

Affects: Credit Health — peak-time eligible capacity and credit redemption warnings. Does not change main P&L revenue or monthly capacity totals.`,
} as const;
