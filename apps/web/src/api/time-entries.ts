import type { TimeEntryInput } from "@rushhours/domain";
import { apiFetch } from "./client";

/**
 * §6 shapes as actually returned by `apps/api/src/time-entries/*` (verified
 * against `time-entries.controller.ts`/`time-entries.service.ts` directly,
 * not re-derived). Plain ISO date/time strings — these are the wire shape
 * *after* `apiFetch`'s `.json()`, distinct from `TimeEntryInput` (the
 * `Date`-typed `PUT` body type from `@rushhours/domain`, via `z.coerce.date()`).
 */
export interface TimeEntryRecord {
  date: string;
  arrivalTime: string;
  departureTime: string;
  lunchBreakStart: string;
  lunchBreakEnd: string;
}

export interface DayTotals {
  workedMinutes: number;
  targetMinutes: number;
  balanceMinutes: number;
}

export interface DaySummary extends DayTotals {
  date: string;
}

export interface WeekSummary extends DayTotals {
  start: string;
  end: string;
}

export interface RangeSummary {
  days: DaySummary[];
  weeks: WeekSummary[];
  total: DayTotals;
}

/** §6 `GET /time-entries?month=YYYY-MM` — raw entries for the month, no `id`. */
export function listMonth(month: string): Promise<TimeEntryRecord[]> {
  return apiFetch<TimeEntryRecord[]>(
    `/time-entries?month=${encodeURIComponent(month)}`,
  );
}

/** §6 `GET /time-entries/summary?month=YYYY-MM`. */
export function getSummary(month: string): Promise<RangeSummary> {
  return apiFetch<RangeSummary>(
    `/time-entries/summary?month=${encodeURIComponent(month)}`,
  );
}

/** §6 `PUT /time-entries/:date` — upsert, body validated by `timeEntrySchema`. */
export function upsertTimeEntry(
  date: string,
  input: TimeEntryInput,
): Promise<TimeEntryRecord> {
  return apiFetch<TimeEntryRecord>(
    `/time-entries/${encodeURIComponent(date)}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}
