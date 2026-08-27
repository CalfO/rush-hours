import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { WebauthnChallengeType } from "@prisma/client";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
  VerifiedRegistrationResponse,
} from "@simplewebauthn/server";
import { PrismaService } from "../prisma/prisma.service";
import { ChallengeStoreService } from "./challenge-store.service";
import { SessionService } from "./session.service";
import { WebauthnService } from "./webauthn.service";

/**
 * Orchestrates the WebAuthn ceremonies: talks to Prisma (User/Credential), the pure
 * `WebauthnService` wrapper, and `ChallengeStoreService`. No WebAuthn-library or
 * cookie-signing details live here — see `webauthn.service.ts`/`session.service.ts`.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webauthn: WebauthnService,
    private readonly challengeStore: ChallengeStoreService,
    private readonly session: SessionService,
    private readonly logger: PinoLogger,
  ) {
    // Plain (non-`@InjectPinoLogger`) injection deliberately: the decorator's
    // provider is only registered for classes that were already `require()`d by
    // the time `LoggerModule.forRootAsync` runs, which depends on module import
    // order — setting the context explicitly here sidesteps that footgun.
    this.logger.setContext(AuthService.name);
  }

  /**
   * §5.2 — POST /auth/webauthn/register/options. Only a known username with zero
   * existing credentials may start the bootstrap-enrollment ceremony.
   */
  async getRegistrationOptions(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { credentials: true },
    });

    if (!user || user.credentials.length > 0) {
      throw new ConflictException(
        "Registration is not available for this account",
      );
    }

    const options = await this.webauthn.generateRegistrationOptions(
      user.id,
      user.username,
    );

    await this.challengeStore.save(
      user.id,
      WebauthnChallengeType.REGISTRATION,
      options.challenge,
    );

    return options;
  }

  /** §5.2 — POST /auth/webauthn/register/verify. Returns a signed session JWT. */
  async verifyRegistration(
    username: string,
    attestationResponse: RegistrationResponseJSON,
  ): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { username } });

    if (!user) {
      throw new ConflictException(
        "Registration is not available for this account",
      );
    }

    const expectedChallenge = await this.challengeStore.consume(
      user.id,
      WebauthnChallengeType.REGISTRATION,
    );

    let verification: VerifiedRegistrationResponse;
    try {
      verification = await this.webauthn.verifyRegistrationResponse(
        attestationResponse,
        expectedChallenge,
      );
    } catch (error: unknown) {
      this.logger.warn(
        { username, err: error },
        "WebAuthn registration verification threw",
      );
      throw new UnauthorizedException("WebAuthn registration failed");
    }

    if (!verification.verified || !verification.registrationInfo) {
      this.logger.warn({ username }, "WebAuthn registration not verified");
      throw new UnauthorizedException("WebAuthn registration failed");
    }

    const { credential } = verification.registrationInfo;

    await this.prisma.credential.create({
      data: {
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ?? [],
        userId: user.id,
      },
    });

    return this.session.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
    });
  }

  /**
   * §5.2 — POST /auth/webauthn/login/options. Only a known username with at least
   * one registered credential may start the authentication ceremony.
   */
  async getLoginOptions(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { credentials: true },
    });

    if (!user || user.credentials.length === 0) {
      throw new NotFoundException("No passkey registered for this account");
    }

    const options = await this.webauthn.generateAuthenticationOptions(
      user.credentials.map((credential) => ({
        id: credential.credentialId,
        transports: credential.transports as AuthenticatorTransportFuture[],
      })),
    );

    await this.challengeStore.save(
      user.id,
      WebauthnChallengeType.AUTHENTICATION,
      options.challenge,
    );

    return options;
  }

  /** §5.2 — POST /auth/webauthn/login/verify. Returns a signed session JWT. */
  async verifyLogin(
    username: string,
    assertionResponse: AuthenticationResponseJSON,
  ): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { credentials: true },
    });

    if (!user) {
      throw new NotFoundException("No passkey registered for this account");
    }

    const expectedChallenge = await this.challengeStore.consume(
      user.id,
      WebauthnChallengeType.AUTHENTICATION,
    );

    const matchedCredential = user.credentials.find(
      (credential) => credential.credentialId === assertionResponse.id,
    );

    if (!matchedCredential) {
      this.logger.warn({ username }, "WebAuthn login: unknown credential id");
      throw new UnauthorizedException("Unknown credential");
    }

    // Interactive transaction: the counter must be read, verified (it must not have
    // gone backwards — @simplewebauthn/server's verify call throws otherwise) and
    // incremented atomically, or a replayed assertion could race two concurrent
    // requests past the check before either write lands (prisma-best-practices §3).
    try {
      await this.prisma.$transaction(async (tx) => {
        const credential = await tx.credential.findUniqueOrThrow({
          where: { id: matchedCredential.id },
        });

        const verification = await this.webauthn.verifyAuthenticationResponse(
          assertionResponse,
          expectedChallenge,
          {
            id: credential.credentialId,
            publicKey: new Uint8Array(credential.publicKey),
            counter: Number(credential.counter),
            transports: credential.transports as AuthenticatorTransportFuture[],
          },
        );

        if (!verification.verified) {
          throw new UnauthorizedException("WebAuthn authentication failed");
        }

        await tx.credential.update({
          where: { id: credential.id },
          data: { counter: verification.authenticationInfo.newCounter },
        });
      });
    } catch (error: unknown) {
      this.logger.warn(
        { username, err: error },
        "WebAuthn login verification failed",
      );
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("WebAuthn authentication failed");
    }

    return this.session.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
    });
  }

  /** §5.2 — GET /auth/me. Explicit `select` — never spread the raw `User` model. */
  async getMe(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        firstName: true,
        lastName: true,
        email: true,
        onboardingCompletedAt: true,
      },
    });
  }
}
