import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { ApiError } from "../api/client";
import {
  getLoginOptions,
  verifyLogin,
  getRegistrationOptions,
  verifyRegistration,
} from "../api/auth";
import { useAuth } from "../auth/AuthProvider";

type LoginStep =
  "idle" | "checking" | "offer-register" | "ceremony-in-progress" | "error";

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const [username, setUsername] = useState("");
  const [step, setStep] = useState<LoginStep>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const isBusy = step === "checking" || step === "ceremony-in-progress";

  // Shared by both the login and the registration ceremony: `refresh()`
  // re-fetches the just-authenticated user (the verify endpoints only
  // return `{ verified: true }`), and its return value lets us decide the
  // destination synchronously rather than waiting on a context re-render.
  async function completeAuth() {
    const authenticatedUser = await refresh();
    navigate(authenticatedUser?.onboardingCompletedAt ? "/" : "/onboarding", {
      replace: true,
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStep("checking");

    let options;
    try {
      options = await getLoginOptions(username);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setStep("offer-register");
        return;
      }
      setErrorMessage(t("auth.genericError"));
      setStep("error");
      return;
    }

    setStep("ceremony-in-progress");
    try {
      const assertionResponse = await startAuthentication({
        optionsJSON: options,
      });
      await verifyLogin(username, assertionResponse);
      await completeAuth();
    } catch {
      // Covers both a rejected WebAuthn ceremony (cancelled, no
      // authenticator, NotAllowedError, ...) and a failure of our own
      // verify/refresh calls — either way, a generic retry message.
      setErrorMessage(t("auth.ceremonyError"));
      setStep("error");
    }
  }

  async function handleRegister() {
    setStep("ceremony-in-progress");
    try {
      const options = await getRegistrationOptions(username);
      const attestationResponse = await startRegistration({
        optionsJSON: options,
      });
      await verifyRegistration(username, attestationResponse);
      await completeAuth();
    } catch {
      // A 409 here (account already has a credential) is an edge case that
      // shouldn't normally be reachable — this button only appears after a
      // 404 from getLoginOptions — so it gets the same generic message as
      // a cancelled/failed ceremony rather than a dedicated branch.
      setErrorMessage(t("auth.ceremonyError"));
      setStep("error");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-surface-900">
          {t("auth.title")}
        </h1>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="mt-6 flex flex-col gap-4"
        >
          <label className="flex flex-col gap-1 text-sm text-surface-700">
            {t("auth.usernameLabel")}
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder={t("auth.usernamePlaceholder")}
              className="rounded border border-surface-500 px-3 py-2"
              disabled={isBusy}
              required
            />
          </label>
          <button
            type="submit"
            className="rounded bg-surface-900 px-4 py-2 text-white disabled:opacity-50"
            disabled={isBusy || username.trim() === ""}
          >
            {t("auth.continue")}
          </button>
        </form>

        {step === "offer-register" && (
          <div className="mt-4">
            <p className="text-sm text-surface-700">
              {t("auth.offerRegisterMessage")}
            </p>
            <button
              type="button"
              onClick={() => void handleRegister()}
              className="mt-2 rounded bg-surface-900 px-4 py-2 text-white disabled:opacity-50"
              disabled={isBusy}
            >
              {t("auth.offerRegisterButton")}
            </button>
          </div>
        )}

        {step === "error" && (
          <p className="mt-4 text-sm text-red-600">{errorMessage}</p>
        )}
      </div>
    </div>
  );
}
