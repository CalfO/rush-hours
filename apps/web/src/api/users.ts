import type { ProfileInput, WorkScheduleInput } from "@rushhours/domain";
import { apiFetch } from "./client";
import type { AuthUser } from "./auth";

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

/**
 * §6 `PATCH /users/me`. `apps/api/src/users/users.service.ts`'s
 * `updateProfile` `select`s the full `{ id, username, role, firstName,
 * lastName, email, onboardingCompletedAt }` shape — field-for-field
 * identical to `AuthUser`, not just the 3 submitted fields — so the return
 * type is `AuthUser`, not `ProfileInput`.
 */
export function updateProfile(input: ProfileInput): Promise<AuthUser> {
  return apiFetch<AuthUser>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
