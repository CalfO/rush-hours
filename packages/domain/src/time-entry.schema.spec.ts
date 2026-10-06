import { timeEntrySchema } from "./time-entry.schema";

/**
 * Spec traceability — `prompts/spec/rushhours-full-spec.md` §4.2 (validation d'une
 * saisie journalière) :
 *
 * - `arrivalTime < lunchBreakStart < lunchBreakEnd < departureTime` -> "ordering"
 *   describe block below, one test per possible inversion.
 * - `lunchBreakStart >= 12:00` et `lunchBreakEnd <= 14:00` (bornes incluses) ->
 *   "lunch break bounds" describe block, one test per side of each bound.
 * - `lunchBreakEnd - lunchBreakStart > 0` -> covered both by the ordering block
 *   (zero-length lunch break) and implicitly wherever a valid lunch break is used.
 * - Toutes les heures sur le même jour calendaire que `date` -> "same calendar day"
 *   describe block, one test per field.
 */

const BASE_DATE = "2026-03-10"; // Tuesday, arbitrary weekday with no other significance

function iso(dateStr: string, timeStr: string): string {
  return `${dateStr}T${timeStr}:00.000Z`;
}

function baseEntry(overrides: Record<string, string> = {}) {
  return {
    date: BASE_DATE,
    arrivalTime: iso(BASE_DATE, "08:00"),
    lunchBreakStart: iso(BASE_DATE, "12:00"),
    lunchBreakEnd: iso(BASE_DATE, "13:00"),
    departureTime: iso(BASE_DATE, "17:00"),
    ...overrides,
  };
}

describe("timeEntrySchema (§4.2)", () => {
  it("accepts a valid entry with the lunch break fully inside 12:00-14:00", () => {
    const result = timeEntrySchema.safeParse(baseEntry());
    expect(result.success).toBe(true);
  });

  describe("ordering: arrivalTime < lunchBreakStart < lunchBreakEnd < departureTime", () => {
    it("rejects when arrivalTime is after lunchBreakStart", () => {
      const result = timeEntrySchema.safeParse(
        baseEntry({ arrivalTime: iso(BASE_DATE, "12:30") }),
      );
      expect(result.success).toBe(false);
    });

    it("rejects when arrivalTime equals lunchBreakStart", () => {
      const result = timeEntrySchema.safeParse(
        baseEntry({ arrivalTime: iso(BASE_DATE, "12:00") }),
      );
      expect(result.success).toBe(false);
    });

    it("rejects when lunchBreakStart is after lunchBreakEnd", () => {
      const result = timeEntrySchema.safeParse(
        baseEntry({
          lunchBreakStart: iso(BASE_DATE, "13:30"),
          lunchBreakEnd: iso(BASE_DATE, "13:00"),
        }),
      );
      expect(result.success).toBe(false);
    });

    it("rejects a zero-length lunch break (lunchBreakEnd equals lunchBreakStart)", () => {
      const result = timeEntrySchema.safeParse(
        baseEntry({
          lunchBreakStart: iso(BASE_DATE, "13:00"),
          lunchBreakEnd: iso(BASE_DATE, "13:00"),
        }),
      );
      expect(result.success).toBe(false);
    });

    it("rejects when lunchBreakEnd is after departureTime", () => {
      const result = timeEntrySchema.safeParse(
        baseEntry({
          lunchBreakStart: iso(BASE_DATE, "16:00"),
          lunchBreakEnd: iso(BASE_DATE, "16:30"),
          departureTime: iso(BASE_DATE, "16:15"),
        }),
      );
      expect(result.success).toBe(false);
    });

    it("rejects when lunchBreakEnd equals departureTime", () => {
      const result = timeEntrySchema.safeParse(
        baseEntry({ departureTime: iso(BASE_DATE, "13:00") }), // same instant as lunchBreakEnd
      );
      expect(result.success).toBe(false);
    });
  });

  describe("lunch break bounds: 12:00 <= lunchBreakStart and lunchBreakEnd <= 14:00 (bounds inclusive)", () => {
    it("rejects lunchBreakStart one minute before 12:00", () => {
      const result = timeEntrySchema.safeParse(
        baseEntry({
          lunchBreakStart: iso(BASE_DATE, "11:59"),
          lunchBreakEnd: iso(BASE_DATE, "12:30"),
        }),
      );
      expect(result.success).toBe(false);
    });

    it("accepts lunchBreakStart exactly at 12:00 (lower bound inclusive)", () => {
      const result = timeEntrySchema.safeParse(
        baseEntry({
          lunchBreakStart: iso(BASE_DATE, "12:00"),
          lunchBreakEnd: iso(BASE_DATE, "12:30"),
        }),
      );
      expect(result.success).toBe(true);
    });

    it("rejects lunchBreakEnd one minute after 14:00", () => {
      const result = timeEntrySchema.safeParse(
        baseEntry({
          lunchBreakStart: iso(BASE_DATE, "13:30"),
          lunchBreakEnd: iso(BASE_DATE, "14:01"),
          departureTime: iso(BASE_DATE, "18:00"),
        }),
      );
      expect(result.success).toBe(false);
    });

    it("accepts lunchBreakEnd exactly at 14:00 (upper bound inclusive)", () => {
      const result = timeEntrySchema.safeParse(
        baseEntry({
          lunchBreakStart: iso(BASE_DATE, "13:30"),
          lunchBreakEnd: iso(BASE_DATE, "14:00"),
          departureTime: iso(BASE_DATE, "18:00"),
        }),
      );
      expect(result.success).toBe(true);
    });
  });

  describe("all timestamps must be on the same calendar day as `date`", () => {
    // A day *before* `date` for a "starting" field and a day *after* `date` for a
    // "closing" field keep the arrival < lunch < departure ordering intact, so the
    // rejection below can only be attributed to the calendar-day rule, not to a
    // coincidental ordering violation.
    it.each([
      ["arrivalTime", { arrivalTime: iso("2026-03-09", "08:00") }, "arrivalTime"],
      [
        "lunchBreakStart",
        {
          arrivalTime: iso("2026-01-01", "08:00"),
          lunchBreakStart: iso("2026-03-09", "12:00"),
        },
        "lunchBreakStart",
      ],
      [
        "lunchBreakEnd",
        {
          lunchBreakEnd: iso("2026-03-11", "13:00"),
          departureTime: iso("2026-12-31", "17:00"),
        },
        "lunchBreakEnd",
      ],
      [
        "departureTime",
        { departureTime: iso("2026-03-11", "17:00") },
        "departureTime",
      ],
    ])("rejects when %s is on a different calendar day than date", (_label, overrides, field) => {
      const result = timeEntrySchema.safeParse(baseEntry(overrides));
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((issue) => issue.message);
        expect(
          messages.some(
            (message) =>
              message.includes(field) && /calendar day/i.test(message),
          ),
        ).toBe(true);
      }
    });
  });
});
