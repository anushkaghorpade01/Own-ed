/**
 * Calendar-aware session counting for Standing Spot recurringSlots[].
 * Never use classes/week × 4 as a substitute for actual calendar counts.
 */
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isWithinInterval,
  parseISO,
  isSameDay,
} from "date-fns";
import type { StandingSpotSlot } from "../schemas";

const DAY_MAP: Record<StandingSpotSlot["day"], number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

export interface CalendarSessionOptions {
  /** Reference month — defaults to current month */
  referenceDate?: Date;
  /** Commitment / membership start (mid-month start) */
  periodStart?: Date;
  /** Commitment / membership end (mid-month end) */
  periodEnd?: Date;
  /** ISO date strings for studio holidays / closed days */
  holidays?: string[];
  /** ISO date strings for paused/cancelled class dates */
  pausedDates?: string[];
}

export interface SlotSessionCount {
  slot: StandingSpotSlot;
  occurrences: number;
  dates: Date[];
}

export interface CalendarSessionResult {
  totalSessions: number;
  bySlot: SlotSessionCount[];
  monthLabel: string;
}

function isHoliday(date: Date, holidays: string[]): boolean {
  return holidays.some((h) => {
    try {
      return isSameDay(date, parseISO(h));
    } catch {
      return false;
    }
  });
}

function isPaused(date: Date, pausedDates: string[]): boolean {
  return pausedDates.some((p) => {
    try {
      return isSameDay(date, parseISO(p));
    } catch {
      return false;
    }
  });
}

/** Count how many times a day-of-week occurs in a month, respecting boundaries and exclusions */
export function countSlotOccurrencesInMonth(
  slot: StandingSpotSlot,
  options: CalendarSessionOptions = {}
): SlotSessionCount {
  const ref = options.referenceDate ?? new Date();
  const monthStart = startOfMonth(ref);
  const monthEnd = endOfMonth(ref);

  const effectiveStart = options.periodStart
    ? new Date(Math.max(monthStart.getTime(), options.periodStart.getTime()))
    : monthStart;
  const effectiveEnd = options.periodEnd
    ? new Date(Math.min(monthEnd.getTime(), options.periodEnd.getTime()))
    : monthEnd;

  if (effectiveStart > effectiveEnd) {
    return { slot, occurrences: 0, dates: [] };
  }

  const holidays = options.holidays ?? [];
  const paused = options.pausedDates ?? [];
  const targetDow = DAY_MAP[slot.day];

  const days = eachDayOfInterval({ start: effectiveStart, end: effectiveEnd });
  const matching = days.filter(
    (d) =>
      getDay(d) === targetDow &&
      !isHoliday(d, holidays) &&
      !isPaused(d, paused)
  );

  return {
    slot,
    occurrences: matching.length,
    dates: matching,
  };
}

export function countRecurringSlotSessions(
  slots: StandingSpotSlot[],
  options: CalendarSessionOptions = {}
): CalendarSessionResult {
  const ref = options.referenceDate ?? new Date();
  const bySlot = slots.map((slot) => countSlotOccurrencesInMonth(slot, options));
  const totalSessions = bySlot.reduce((sum, s) => sum + s.occurrences, 0);

  return {
    totalSessions,
    bySlot,
    monthLabel: ref.toLocaleString("en-IN", { month: "long", year: "numeric" }),
  };
}

/** Count sessions across a multi-month commitment period */
export function countRecurringSlotSessionsForCommitment(
  slots: StandingSpotSlot[],
  commitmentMonths: number,
  options: CalendarSessionOptions = {}
): number {
  const start = options.periodStart ?? options.referenceDate ?? new Date();
  let total = 0;
  for (let m = 0; m < commitmentMonths; m++) {
    const ref = new Date(start.getFullYear(), start.getMonth() + m, 1);
    const result = countRecurringSlotSessions(slots, {
      ...options,
      referenceDate: ref,
      periodStart: m === 0 ? options.periodStart : undefined,
      periodEnd: m === commitmentMonths - 1 ? options.periodEnd : undefined,
    });
    total += result.totalSessions;
  }
  return total;
}

export function isDateInRange(date: Date, start?: Date, end?: Date): boolean {
  if (start && end) return isWithinInterval(date, { start, end });
  if (start) return date >= start;
  if (end) return date <= end;
  return true;
}
