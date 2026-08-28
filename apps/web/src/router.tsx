import { createBrowserRouter, Outlet } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/OnboardingPage";
import TimeEntryPage from "./pages/TimeEntryPage";
import AnalyticsPage from "./pages/AnalyticsPage";

/**
 * Pathless wrapper for every route that will require an authenticated
 * session. Currently a plain passthrough — step 7 replaces this element
 * with a real `<RequireAuth>` guard without needing to restructure the
 * route tree.
 */
function AppLayout() {
  return <Outlet />;
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <TimeEntryPage /> },
      { path: "/analytics", element: <AnalyticsPage /> },
      { path: "/onboarding", element: <OnboardingPage /> },
    ],
  },
]);
