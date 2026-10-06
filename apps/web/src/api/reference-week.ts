import type {
  ReferenceWeekDayInput,
  ReferenceWeekInput,
} from "@rushhours/domain";
import { apiFetch } from "./client";

/**
 * §5.4 `GET /users/me/reference-week` response shape — `exists: false,
 * days: []` when the user has never saved one. This is a wire-response
 * shape (it carries `exists`, which has no meaning as a domain concept on
 * its own), so it's declared locally rather than in `packages/domain`,
 * mirroring `apps/web/src/api/users.ts`'s own `getWorkSchedule` doc comment
 * on when a response type needs its own local declaration.
 */
export interface ReferenceWeekState {
  exists: boolean;
  days: ReferenceWeekDayInput[];
}

export function getReferenceWeek(): Promise<ReferenceWeekState> {
  return apiFetch<ReferenceWeekState>("/users/me/reference-week");
}

/** §5.4 `PUT /users/me/reference-week` — full replace. */
export function putReferenceWeek(
  input: ReferenceWeekInput,
): Promise<ReferenceWeekState> {
  return apiFetch<ReferenceWeekState>("/users/me/reference-week", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

/** §5.4 `DELETE /users/me/reference-week` — idempotent, no error if already empty. */
export function deleteReferenceWeek(): Promise<{ success: true }> {
  return apiFetch<{ success: true }>("/users/me/reference-week", {
    method: "DELETE",
  });
}
