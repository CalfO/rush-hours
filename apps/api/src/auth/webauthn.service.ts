import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  Base64URLString,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  VerifiedAuthenticationResponse,
  VerifiedRegistrationResponse,
  WebAuthnCredential,
} from "@simplewebauthn/server";

const RP_NAME = "RushHours";

export interface CredentialDescriptor {
  id: Base64URLString;
  transports?: AuthenticatorTransportFuture[];
}

/**
 * Pure wrapper around `@simplewebauthn/server` — no Prisma access here, all
 * persistence (users, credentials, challenges) is orchestrated by `AuthService`.
 * `rpID`/`origin` come from `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN` (see spec §5.2).
 */
@Injectable()
export class WebauthnService {
  constructor(private readonly config: ConfigService) {}

  private get rpID(): string {
    return this.config.get<string>("WEBAUTHN_RP_ID")!;
  }

  private get origin(): string {
    return this.config.get<string>("WEBAUTHN_ORIGIN")!;
  }

  generateRegistrationOptions(
    userId: string,
    username: string,
    excludeCredentials: CredentialDescriptor[] = [],
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    return generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: this.rpID,
      userName: username,
      userID: new TextEncoder().encode(userId),
      attestationType: "none",
      excludeCredentials,
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });
  }

  verifyRegistrationResponse(
    response: RegistrationResponseJSON,
    expectedChallenge: string,
  ): Promise<VerifiedRegistrationResponse> {
    return verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
    });
  }

  generateAuthenticationOptions(
    allowCredentials: CredentialDescriptor[],
  ): Promise<PublicKeyCredentialRequestOptionsJSON> {
    return generateAuthenticationOptions({
      rpID: this.rpID,
      allowCredentials,
      userVerification: "preferred",
    });
  }

  verifyAuthenticationResponse(
    response: AuthenticationResponseJSON,
    expectedChallenge: string,
    credential: WebAuthnCredential,
  ): Promise<VerifiedAuthenticationResponse> {
    return verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
      credential,
    });
  }
}
