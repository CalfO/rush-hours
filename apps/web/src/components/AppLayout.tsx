import { Outlet } from "react-router-dom";
import { Header } from "./Header";

/**
 * Pathless layout route nested inside `RequireAuth` (see
 * `apps/web/src/router.tsx`), sibling of `/onboarding` rather than wrapping
 * it — onboarding gets no header. Deliberately thin: no auth/onboarding
 * logic here, `RequireAuth` stays the sole authority for that (spec §7.1).
 */
export default function AppLayout() {
  return (
    <>
      <Header />
      <Outlet />
    </>
  );
}
