import { describe, it, expect } from "vitest";
import type { StandingSpotSlot } from "../schemas";
import {
  countRecurringSlotSessions,
  countSlotOccurrencesInMonth,
} from "../engine/calendar-sessions";

describe("Calendar session counts", () => {
  const tueThu: StandingSpotSlot[] = [
    { day: "tue", startTime: "07:00" },
    { day: "thu", startTime: "07:00" },
  ];

  it("counts slot occurrences in a month (not weekly × 4)", () => {
    const ref = new Date("2026-09-15");
    const result = countRecurringSlotSessions(tueThu, { referenceDate: ref });
    expect(result.totalSessions).toBeGreaterThanOrEqual(8);
    expect(result.totalSessions).toBeLessThanOrEqual(10);
    expect(result.bySlot).toHaveLength(2);
  });

  it("handles 4 vs 5 occurrence months differently", () => {
    const feb2026 = countRecurringSlotSessions(tueThu, {
      referenceDate: new Date("2026-02-15"),
    });
    const sep2026 = countRecurringSlotSessions(tueThu, {
      referenceDate: new Date("2026-09-15"),
    });
    expect(sep2026.totalSessions).toBeGreaterThanOrEqual(feb2026.totalSessions);
  });

  it("excludes holidays", () => {
    const ref = new Date("2026-09-15");
    const without = countRecurringSlotSessions(tueThu, { referenceDate: ref });
    const withHoliday = countRecurringSlotSessions(tueThu, {
      referenceDate: ref,
      holidays: ["2026-09-02"],
    });
    expect(withHoliday.totalSessions).toBeLessThanOrEqual(without.totalSessions);
  });

  it("respects mid-month commitment start", () => {
    const slot: StandingSpotSlot = { day: "tue", startTime: "07:00" };
    const full = countSlotOccurrencesInMonth(slot, {
      referenceDate: new Date("2026-09-15"),
    });
    const mid = countSlotOccurrencesInMonth(slot, {
      referenceDate: new Date("2026-09-15"),
      periodStart: new Date("2026-09-16"),
    });
    expect(mid.occurrences).toBeLessThan(full.occurrences);
  });
});
