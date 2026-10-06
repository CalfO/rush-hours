import { workScheduleSchema } from "./work-schedule.schema";

/**
 * Spec traceability — `prompts/spec/rushhours-full-spec.md` §5.5/§6 (`work-schedule`
 * payload validation): "Valide `sum(targetMinutes) === weeklyContractHours * 60`,
 * ≥1 jour."
 */
describe("workScheduleSchema (§5.5/§6)", () => {
  it("accepts a schedule whose targetMinutes sum exactly matches weeklyContractHours * 60", () => {
    const result = workScheduleSchema.safeParse({
      weeklyContractHours: 35,
      weekStartDay: "MONDAY",
      days: [
        { weekday: "MONDAY", targetMinutes: 420 },
        { weekday: "TUESDAY", targetMinutes: 420 },
        { weekday: "WEDNESDAY", targetMinutes: 420 },
        { weekday: "THURSDAY", targetMinutes: 420 },
        { weekday: "FRIDAY", targetMinutes: 420 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a schedule whose targetMinutes sum is below weeklyContractHours * 60", () => {
    const result = workScheduleSchema.safeParse({
      weeklyContractHours: 35,
      weekStartDay: "MONDAY",
      days: [{ weekday: "MONDAY", targetMinutes: 60 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a schedule whose targetMinutes sum is above weeklyContractHours * 60", () => {
    const result = workScheduleSchema.safeParse({
      weeklyContractHours: 35,
      weekStartDay: "MONDAY",
      days: [{ weekday: "MONDAY", targetMinutes: 2160 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a schedule with zero working days checked", () => {
    const result = workScheduleSchema.safeParse({
      weeklyContractHours: 35,
      weekStartDay: "MONDAY",
      days: [],
    });
    expect(result.success).toBe(false);
  });
});
