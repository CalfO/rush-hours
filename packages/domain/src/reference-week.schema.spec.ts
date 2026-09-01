import {
  referenceWeekDaySchema,
  referenceWeekSchema,
} from "./reference-week.schema";

/**
 * Spec traceability — `prompts/spec/time-entry-ux-and-reference-week.md` §5.1/§5.3:
 *
 * - Minutes fields all in `[0, 1439]`.
 * - `arrivalMinutes < lunchBreakStartMinutes < lunchBreakEndMinutes < departureMinutes`.
 * - `lunchBreakStartMinutes >= 12:00 (720)`, `lunchBreakEndMinutes <= 14:00 (840)`.
 * - `referenceWeekSchema`: 1 to 7 entries, unique `weekday` per array.
 */

function baseDay(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    weekday: "MONDAY",
    arrivalMinutes: 8 * 60, // 08:00
    lunchBreakStartMinutes: 12 * 60, // 12:00
    lunchBreakEndMinutes: 13 * 60, // 13:00
    departureMinutes: 17 * 60, // 17:00
    ...overrides,
  };
}

describe("referenceWeekDaySchema (§5.1/§5.3)", () => {
  it("accepts a valid day with the lunch break inside 12:00-14:00", () => {
    const result = referenceWeekDaySchema.safeParse(baseDay());
    expect(result.success).toBe(true);
  });

  it.each([
    ["arrivalMinutes", -1],
    ["arrivalMinutes", 1440],
    ["departureMinutes", -1],
    ["departureMinutes", 1440],
    ["lunchBreakStartMinutes", -1],
    ["lunchBreakStartMinutes", 1440],
    ["lunchBreakEndMinutes", -1],
    ["lunchBreakEndMinutes", 1440],
  ])("rejects %s out of [0, 1439] range (%d)", (field, value) => {
    const result = referenceWeekDaySchema.safeParse(
      baseDay({ [field]: value }),
    );
    expect(result.success).toBe(false);
  });

  describe("ordering: arrivalMinutes < lunchBreakStartMinutes < lunchBreakEndMinutes < departureMinutes", () => {
    it("rejects when arrivalMinutes is after lunchBreakStartMinutes", () => {
      const result = referenceWeekDaySchema.safeParse(
        baseDay({ arrivalMinutes: 12 * 60 + 30 }),
      );
      expect(result.success).toBe(false);
    });

    it("rejects when lunchBreakStartMinutes is after lunchBreakEndMinutes", () => {
      const result = referenceWeekDaySchema.safeParse(
        baseDay({
          lunchBreakStartMinutes: 13 * 60 + 30,
          lunchBreakEndMinutes: 13 * 60,
        }),
      );
      expect(result.success).toBe(false);
    });

    it("rejects when lunchBreakEndMinutes is after departureMinutes", () => {
      const result = referenceWeekDaySchema.safeParse(
        baseDay({
          lunchBreakStartMinutes: 16 * 60,
          lunchBreakEndMinutes: 16 * 60 + 30,
          departureMinutes: 16 * 60 + 15,
        }),
      );
      expect(result.success).toBe(false);
    });
  });

  describe("lunch break window: 12:00 <= lunchBreakStartMinutes and lunchBreakEndMinutes <= 14:00", () => {
    it("rejects lunchBreakStartMinutes one minute before 12:00", () => {
      const result = referenceWeekDaySchema.safeParse(
        baseDay({
          lunchBreakStartMinutes: 12 * 60 - 1,
          lunchBreakEndMinutes: 12 * 60 + 30,
        }),
      );
      expect(result.success).toBe(false);
    });

    it("rejects lunchBreakEndMinutes one minute after 14:00", () => {
      const result = referenceWeekDaySchema.safeParse(
        baseDay({
          lunchBreakStartMinutes: 13 * 60 + 30,
          lunchBreakEndMinutes: 14 * 60 + 1,
          departureMinutes: 18 * 60,
        }),
      );
      expect(result.success).toBe(false);
    });
  });
});

describe("referenceWeekSchema (§5.1/§5.3)", () => {
  it("rejects an empty array", () => {
    const result = referenceWeekSchema.safeParse([]);
    expect(result.success).toBe(false);
  });

  it("rejects a duplicate weekday in the array", () => {
    const result = referenceWeekSchema.safeParse([
      baseDay({ weekday: "MONDAY" }),
      baseDay({ weekday: "MONDAY" }),
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects an 8-entry array with a duplicate weekday", () => {
    const result = referenceWeekSchema.safeParse([
      baseDay({ weekday: "MONDAY" }),
      baseDay({ weekday: "TUESDAY" }),
      baseDay({ weekday: "WEDNESDAY" }),
      baseDay({ weekday: "THURSDAY" }),
      baseDay({ weekday: "FRIDAY" }),
      baseDay({ weekday: "SATURDAY" }),
      baseDay({ weekday: "SUNDAY" }),
      baseDay({ weekday: "MONDAY" }),
    ]);
    expect(result.success).toBe(false);
  });

  it("accepts exactly 7 entries with all unique weekdays", () => {
    const result = referenceWeekSchema.safeParse([
      baseDay({ weekday: "MONDAY" }),
      baseDay({ weekday: "TUESDAY" }),
      baseDay({ weekday: "WEDNESDAY" }),
      baseDay({ weekday: "THURSDAY" }),
      baseDay({ weekday: "FRIDAY" }),
      baseDay({ weekday: "SATURDAY" }),
      baseDay({ weekday: "SUNDAY" }),
    ]);
    expect(result.success).toBe(true);
  });

  it("accepts a single-entry array (1 working day is a valid reference week)", () => {
    const result = referenceWeekSchema.safeParse([baseDay()]);
    expect(result.success).toBe(true);
  });
});
