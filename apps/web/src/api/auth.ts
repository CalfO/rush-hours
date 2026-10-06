import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import { apiFetch } from "./client";

/**
 * Shape returned by `GET /auth/me` (see `apps/api/src/auth/auth.controller.ts`).
 * `role` mirrors the Prisma `Role` enum (`apps/api/prisma/schema.prisma`:
 * `USER` | `ADMIN`). `firstName`/`lastName`/`email` are `string | null`, not
 * `string` — `apps/api/prisma/schema.prisma`'s `User` model has them
 * nullable (`firstName String?`, `lastName String?`, `email String? @unique`):
 * a brand-new pre-onboarding user genuinely has `firstName: null` etc. here.
 */
export interface AuthUser {
  id: string;
  username: string;
  role: "USER" | "ADMIN";
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  onboardingCompletedAt: string | null;
}

interface VerifiedResponse {
  verified: true;
}

export function getLoginOptions(
  username: string,
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  return apiFetch<PublicKeyCredentialRequestOptionsJSON>(
    "/auth/webauthn/login/options",
    {
      method: "POST",
      body: JSON.stringify({ username }),
    },
  );
}

export function verifyLogin(
  username: string,
  assertionResponse: AuthenticationResponseJSON,
): Promise<VerifiedResponse> {
  return apiFetch<VerifiedResponse>("/auth/webauthn/login/verify", {
    method: "POST",
    body: JSON.stringify({ username, assertionResponse }),
  });
}

export function getRegistrationOptions(
  username: string,
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  return apiFetch<PublicKeyCredentialCreationOptionsJSON>(
    "/auth/webauthn/register/options",
    {
      method: "POST",
      body: JSON.stringify({ username }),
    },
  );
}

export function verifyRegistration(
  username: string,
  attestationResponse: RegistrationResponseJSON,
): Promise<VerifiedResponse> {
  return apiFetch<VerifiedResponse>("/auth/webauthn/register/verify", {
    method: "POST",
    body: JSON.stringify({ username, attestationResponse }),
  });
}

export function logout(): Promise<{ success: true }> {
  return apiFetch<{ success: true }>("/auth/logout", { method: "POST" });
}

export function getMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>("/auth/me");
}
