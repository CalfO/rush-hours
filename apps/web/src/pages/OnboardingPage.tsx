import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ProfileForm } from "../components/ProfileForm";
import WorkScheduleModal from "../components/WorkScheduleModal";
import { useAuth } from "../auth/AuthProvider";

type OnboardingStep = "profile" | "work-schedule";

const TOTAL_STEPS = 2;

/**
 * Spec §5.4 — non-bypassable two-step onboarding at `/onboarding`.
 * `RequireAuth` (already in place) redirects here whenever
 * `user.onboardingCompletedAt` is falsy, and redirects away once complete.
 *
 * `step` is local component state — there is no server-side "step 1 done"
 * flag. A page reload mid-step-2 resets the wizard back to step 1. This is
 * a deliberate simplification, not a gap: `PATCH /users/me` is idempotent
 * (re-submitting the same profile data is a no-op), so replaying step 1 on
 * reload costs nothing.
 */
export default function OnboardingPage() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<OnboardingStep>("profile");

  const stepNumber = step === "profile" ? 1 : 2;

  // Mirrors `LoginPage.tsx`'s `completeAuth()` pattern exactly: `refresh()`
  // re-fetches the user (now with `onboardingCompletedAt` set server-side)
  // so `AuthProvider`'s context state is current, then navigates. Without
  // this, `RequireAuth` would keep reading the stale pre-onboarding context
  // value and bounce back to `/onboarding`.
  async function completeOnboarding() {
    await refresh();
    navigate("/", { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <h1 className="text-xl font-semibold text-surface-900">
          {t("app.title")}
        </h1>
        <p className="mb-6 text-sm text-surface-500">
          {t("onboarding.stepIndicator", {
            current: stepNumber,
            total: TOTAL_STEPS,
          })}
        </p>

        {step === "profile" && (
          <ProfileForm
            defaultValues={{
              firstName: user?.firstName ?? "",
              lastName: user?.lastName ?? "",
              email: user?.email ?? "",
            }}
            submitLabel={t("onboarding.continue")}
            onSuccess={() => setStep("work-schedule")}
          />
        )}

        {step === "work-schedule" && (
          <WorkScheduleModal
            open={true}
            onOpenChange={() => {}}
            dismissible={false}
            cancellable={false}
            onSaved={() => void completeOnboarding()}
          />
        )}
      </div>
    </div>
  );
}
