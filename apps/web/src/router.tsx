import { createBrowserRouter } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/OnboardingPage";
import TimeEntryPage from "./pages/TimeEntryPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import { RequireAuth } from "./auth/RequireAuth";
import AppLayout from "./components/AppLayout";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <RequireAuth />,
    children: [
      { path: "/onboarding", element: <OnboardingPage /> },
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <TimeEntryPage /> },
          { path: "/analytics", element: <AnalyticsPage /> },
        ],
      },
    ],
  },
]);
