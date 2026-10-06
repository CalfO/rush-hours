import { Test, TestingModule } from "@nestjs/testing";
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { Role, WebauthnChallengeType } from "@prisma/client";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { WebauthnService } from "./webauthn.service";
import { ChallengeStoreService } from "./challenge-store.service";
import { SessionService } from "./session.service";

/**
 * Spec traceability — §5.1 (POC constraint) & §5.2 (endpoints table) of
 * `prompts/spec/rushhours-full-spec.md`.
 *
 * These are unit tests of the orchestration logic in `AuthService`. Prisma,
 * `WebauthnService` (the WebAuthn-library boundary) and `ChallengeStoreService`
 * are mocked — see `nestjs-best-practices` §5 / `prisma-best-practices` §6.
 * The interactive-transaction counter update (§4.4 of the senior-developer's
 * hand-off notes) is exercised here by faking `prisma.$transaction`'s callback
 * invocation, matching `prisma-best-practices` §3 guidance for testing that
 * pattern without a real DB.
 */
describe("AuthService", () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    credential: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let webauthn: {
    generateRegistrationOptions: jest.Mock;
    verifyRegistrationResponse: jest.Mock;
    generateAuthenticationOptions: jest.Mock;
    verifyAuthenticationResponse: jest.Mock;
  };
  let challengeStore: { save: jest.Mock; consume: jest.Mock };
  let session: { sign: jest.Mock };

  const user = {
    id: "user-1",
    username: "user",
    role: Role.USER,
    credentials: [] as Array<{
      id: string;
      credentialId: string;
      transports: string[];
    }>,
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
      credential: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    webauthn = {
      generateRegistrationOptions: jest.fn(),
      verifyRegistrationResponse: jest.fn(),
      generateAuthenticationOptions: jest.fn(),
      verifyAuthenticationResponse: jest.fn(),
    };
    challengeStore = { save: jest.fn(), consume: jest.fn() };
    session = { sign: jest.fn().mockResolvedValue("signed.jwt.token") };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: WebauthnService, useValue: webauthn },
        { provide: ChallengeStoreService, useValue: challengeStore },
        { provide: SessionService, useValue: session },
        {
          provide: PinoLogger,
          useValue: { setContext: jest.fn(), warn: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe("getRegistrationOptions (§5.2 POST /auth/webauthn/register/options)", () => {
    it("throws 409 when the username is unknown", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getRegistrationOptions("ghost")).rejects.toThrow(
        ConflictException,
      );
      expect(webauthn.generateRegistrationOptions).not.toHaveBeenCalled();
    });

    it("throws 409 when the account already has a credential (§5.1: no re-registration once enrolled)", async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...user,
        credentials: [{ id: "c1", credentialId: "abc", transports: [] }],
      });

      await expect(service.getRegistrationOptions("user")).rejects.toThrow(
        ConflictException,
      );
    });

    it("returns creation options and stores the challenge for a known username with zero credentials", async () => {
      prisma.user.findUnique.mockResolvedValue({ ...user, credentials: [] });
      const options = { challenge: "reg-challenge", rp: {}, user: {} };
      webauthn.generateRegistrationOptions.mockResolvedValue(options);

      const result = await service.getRegistrationOptions("user");

      expect(result).toBe(options);
      expect(challengeStore.save).toHaveBeenCalledWith(
        user.id,
        WebauthnChallengeType.REGISTRATION,
        "reg-challenge",
      );
    });
  });

  describe("verifyRegistration (§5.2 POST /auth/webauthn/register/verify)", () => {
    it("throws 409 when the username is unknown", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyRegistration("ghost", {} as never),
      ).rejects.toThrow(ConflictException);
      expect(challengeStore.consume).not.toHaveBeenCalled();
    });

    it("persists the Credential and returns a signed session on success", async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      challengeStore.consume.mockResolvedValue("reg-challenge");
      webauthn.verifyRegistrationResponse.mockResolvedValue({
        verified: true,
        registrationInfo: {
          credential: {
            id: "new-credential-id",
            publicKey: new Uint8Array([1, 2, 3]),
            counter: 0,
            transports: ["internal"],
          },
        },
      });

      const token = await service.verifyRegistration("user", {} as never);

      expect(challengeStore.consume).toHaveBeenCalledWith(
        user.id,
        WebauthnChallengeType.REGISTRATION,
      );
      expect(prisma.credential.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          credentialId: "new-credential-id",
          counter: 0,
          transports: ["internal"],
          userId: user.id,
        }) as Record<string, unknown>,
      });
      expect(session.sign).toHaveBeenCalledWith({
        sub: user.id,
        username: user.username,
        role: user.role,
      });
      expect(token).toBe("signed.jwt.token");
    });

    it("throws 401 and does not persist a Credential when the ceremony is not verified", async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      challengeStore.consume.mockResolvedValue("reg-challenge");
      webauthn.verifyRegistrationResponse.mockResolvedValue({
        verified: false,
      });

      await expect(
        service.verifyRegistration("user", {} as never),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.credential.create).not.toHaveBeenCalled();
    });

    it("throws 401 and does not persist a Credential when the WebAuthn library itself throws", async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      challengeStore.consume.mockResolvedValue("reg-challenge");
      webauthn.verifyRegistrationResponse.mockRejectedValue(
        new Error("bad signature"),
      );

      await expect(
        service.verifyRegistration("user", {} as never),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.credential.create).not.toHaveBeenCalled();
    });
  });

  describe("getLoginOptions (§5.2 POST /auth/webauthn/login/options)", () => {
    it("throws 404 when the username is unknown", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getLoginOptions("ghost")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws 404 when the account has zero credentials", async () => {
      prisma.user.findUnique.mockResolvedValue({ ...user, credentials: [] });

      await expect(service.getLoginOptions("user")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("returns request options and stores the challenge when at least one credential exists", async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...user,
        credentials: [
          { id: "c1", credentialId: "cred-abc", transports: ["internal"] },
        ],
      });
      const options = { challenge: "auth-challenge" };
      webauthn.generateAuthenticationOptions.mockResolvedValue(options);

      const result = await service.getLoginOptions("user");

      expect(result).toBe(options);
      expect(webauthn.generateAuthenticationOptions).toHaveBeenCalledWith([
        { id: "cred-abc", transports: ["internal"] },
      ]);
      expect(challengeStore.save).toHaveBeenCalledWith(
        user.id,
        WebauthnChallengeType.AUTHENTICATION,
        "auth-challenge",
      );
    });
  });

  describe("verifyLogin (§5.2 POST /auth/webauthn/login/verify)", () => {
    const credentialRow = {
      id: "c1",
      credentialId: "cred-abc",
      publicKey: Buffer.from([1, 2, 3]),
      counter: BigInt(3),
      transports: ["internal"],
    };

    function makeTx() {
      return {
        credential: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(credentialRow),
          update: jest.fn().mockResolvedValue(undefined),
        },
      };
    }

    it("throws 404 when the username is unknown", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyLogin("ghost", { id: "cred-abc" } as never),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws 401 when the assertion references a credential id the account doesn't own", async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...user,
        credentials: [credentialRow],
      });
      challengeStore.consume.mockResolvedValue("auth-challenge");

      await expect(
        service.verifyLogin("user", { id: "unknown-cred-id" } as never),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("increments the credential counter to authenticationInfo.newCounter on a successful assertion", async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...user,
        credentials: [credentialRow],
      });
      challengeStore.consume.mockResolvedValue("auth-challenge");
      const tx = makeTx();
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        fn(tx),
      );
      webauthn.verifyAuthenticationResponse.mockResolvedValue({
        verified: true,
        authenticationInfo: { newCounter: 4 },
      });

      const token = await service.verifyLogin("user", {
        id: "cred-abc",
      } as never);

      expect(tx.credential.update).toHaveBeenCalledWith({
        where: { id: credentialRow.id },
        data: { counter: 4 },
      });
      expect(session.sign).toHaveBeenCalledWith({
        sub: user.id,
        username: user.username,
        role: user.role,
      });
      expect(token).toBe("signed.jwt.token");
    });

    it("does not update the counter when the assertion is not verified (replay/failed check)", async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...user,
        credentials: [credentialRow],
      });
      challengeStore.consume.mockResolvedValue("auth-challenge");
      const tx = makeTx();
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        fn(tx),
      );
      webauthn.verifyAuthenticationResponse.mockResolvedValue({
        verified: false,
      });

      await expect(
        service.verifyLogin("user", { id: "cred-abc" } as never),
      ).rejects.toThrow(UnauthorizedException);
      expect(tx.credential.update).not.toHaveBeenCalled();
    });

    it("does not update the counter when the WebAuthn library rejects the assertion (e.g. counter didn't advance)", async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...user,
        credentials: [credentialRow],
      });
      challengeStore.consume.mockResolvedValue("auth-challenge");
      const tx = makeTx();
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        fn(tx),
      );
      webauthn.verifyAuthenticationResponse.mockRejectedValue(
        new Error("counter did not increase — possible cloned authenticator"),
      );

      await expect(
        service.verifyLogin("user", { id: "cred-abc" } as never),
      ).rejects.toThrow(UnauthorizedException);
      expect(tx.credential.update).not.toHaveBeenCalled();
    });

    it("reads the credential inside the transaction (tx), not via the outer prisma client", async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...user,
        credentials: [credentialRow],
      });
      challengeStore.consume.mockResolvedValue("auth-challenge");
      const tx = makeTx();
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        fn(tx),
      );
      webauthn.verifyAuthenticationResponse.mockResolvedValue({
        verified: true,
        authenticationInfo: { newCounter: 4 },
      });

      await service.verifyLogin("user", { id: "cred-abc" } as never);

      expect(tx.credential.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: credentialRow.id },
      });
    });
  });

  describe("getMe (§5.2 GET /auth/me)", () => {
    it("selects only id/username/role/profile/onboardingCompletedAt — never publicKey/counter/credentials", async () => {
      const publicUser = {
        id: user.id,
        username: user.username,
        role: user.role,
        firstName: null,
        lastName: null,
        email: null,
        onboardingCompletedAt: null,
      };
      prisma.user.findUniqueOrThrow.mockResolvedValue(publicUser);

      const result = await service.getMe(user.id);

      expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: user.id },
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
      expect(result).toEqual(publicUser);
    });
  });
});
