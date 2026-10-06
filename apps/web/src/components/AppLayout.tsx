import { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import {
  getReferenceWeek,
  type ReferenceWeekState,
} from "../api/reference-week";
import { Header } from "./Header";

/**
 * Shape passed to the routed page via `<Outlet context={...} />` and read
 * back with `useOutletContext<AppLayoutContext>()` (react-router v6).
 */
export interface AppLayoutContext {
  referenceWeek: ReferenceWeekState | null;
  refreshReferenceWeek: () => void;
}

/**
 * Pathless layout route nested inside `RequireAuth` (see
 * `apps/web/src/router.tsx`), sibling of `/onboarding` rather than wrapping
 * it — onboarding gets no header. Deliberately thin: no auth/onboarding
 * logic here, `RequireAuth` stays the sole authority for that (spec §7.1).
 *
 * §5.6/§5.7 (`time-entry-ux-and-reference-week.md`): `Header` (delete menu
 * item) and the routed `TimeEntryPage`/`WeekCarousel` (save-prompt trigger,
 * prefill switch) are siblings here, not parent/child, but both need
 * `referenceWeek` and both can mutate it (Header's DELETE, TimeEntryPage's
 * PUT-on-accept). Fetching it independently in each would leave the other
 * sibling stale after a mutation — so the fetch is lifted here, once,
 * fetch-once-while-mounted (`useEffect` with `[]` deps, an `ignore` flag,
 * no synchronous `setState` in the effect body itself — same pattern as
 * `TimeEntryPage`'s own work-schedule fetch), and `refreshReferenceWeek` is
 * exposed to both siblings so either mutation refreshes the other's view
 * immediately, without a page reload.
 */
export default function AppLayout() {
  const [referenceWeek, setReferenceWeek] = useState<ReferenceWeekState | null>(
    null,
  );

  const refreshReferenceWeek = useCallback(() => {
    getReferenceWeek().then(
      (result) => setReferenceWeek(result),
      () => setReferenceWeek(null),
    );
  }, []);

  useEffect(() => {
    let ignore = false;
    getReferenceWeek().then(
      (result) => {
        if (ignore) return;
        setReferenceWeek(result);
      },
      () => {
        if (ignore) return;
        setReferenceWeek(null);
      },
    );
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <>
      <Header
        referenceWeek={referenceWeek}
        refreshReferenceWeek={refreshReferenceWeek}
      />
      <Outlet
        context={
          { referenceWeek, refreshReferenceWeek } satisfies AppLayoutContext
        }
      />
    </>
  );
}
