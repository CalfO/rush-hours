import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

/**
 * Authoritative auth/onboarding enforcement layer, re-evaluated on every
 * render of a protected route (direct URL entry, back/forward navigation, a
 * stale tab) — not just a UX shortcut. This is what makes `/onboarding`
 * genuinely non-bypassable per spec §5.4, independent of how the user
 * arrived at a given URL.
 */
export function RequireAuth() {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return null;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  const needsOnboarding = !user?.onboardingCompletedAt;

  if (needsOnboarding && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  if (!needsOnboarding && location.pathname === "/onboarding") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
