import type { WorkScheduleInput } from "@rushhours/domain";
import { apiFetch } from "./client";

/**
 * §6 `GET /users/me/work-schedule`. `apps/api/src/users/users.service.ts`
 * already converts the Prisma `Decimal` to `Number(user.weeklyContractHours)`
 * server-side, so the JSON response is field-for-field identical to
 * `WorkScheduleInput` — no separate response type needed.
 */
export function getWorkSchedule(): Promise<WorkScheduleInput> {
  return apiFetch<WorkScheduleInput>("/users/me/work-schedule");
}

/** §6 `PUT /users/me/work-schedule` — full replace. */
export function putWorkSchedule(
  input: WorkScheduleInput,
): Promise<WorkScheduleInput> {
  return apiFetch<WorkScheduleInput>("/users/me/work-schedule", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}
