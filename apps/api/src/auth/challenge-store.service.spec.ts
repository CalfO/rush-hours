import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { WebauthnChallengeType } from "@prisma/client";
import { ChallengeStoreService } from "./challenge-store.service";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Spec traceability — senior-developer hand-off note: "le challenge WebAuthn est
 * stocké en base, single-use avec TTL ~2min". This is a pure unit test against a
 * mocked `PrismaService` (prisma-best-practices §6) — it pins the single-use/replay
 * guarantee described, not the SQL used to implement it.
 */
describe("ChallengeStoreService", () => {
  let service: ChallengeStoreService;
  let prisma: {
    webauthnChallenge: {
      upsert: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      webauthnChallenge: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChallengeStoreService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ChallengeStoreService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("save", () => {
    it("upserts the pending challenge for this user/type with a ~2 minute TTL", async () => {
      jest.useFakeTimers().setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

      await service.save(
        "user-1",
        WebauthnChallengeType.REGISTRATION,
        "chal-abc",
      );

      const expectedExpiry = new Date("2026-01-01T00:02:00.000Z");
      expect(prisma.webauthnChallenge.upsert).toHaveBeenCalledWith({
        where: {
          userId_type: {
            userId: "user-1",
            type: WebauthnChallengeType.REGISTRATION,
          },
        },
        update: { challenge: "chal-abc", expiresAt: expectedExpiry },
        create: {
          userId: "user-1",
          type: WebauthnChallengeType.REGISTRATION,
          challenge: "chal-abc",
          expiresAt: expectedExpiry,
        },
      });
    });
  });

  describe("consume", () => {
    it("throws when there is no pending challenge for this user/type", async () => {
      prisma.webauthnChallenge.findUnique.mockResolvedValue(null);

      await expect(
        service.consume("user-1", WebauthnChallengeType.AUTHENTICATION),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.webauthnChallenge.delete).not.toHaveBeenCalled();
    });

    it("returns and deletes the challenge when it is present and not expired", async () => {
      prisma.webauthnChallenge.findUnique.mockResolvedValue({
        id: "row-1",
        challenge: "chal-abc",
        expiresAt: new Date(Date.now() + 60_000),
      });

      const result = await service.consume(
        "user-1",
        WebauthnChallengeType.REGISTRATION,
      );

      expect(result).toBe("chal-abc");
      expect(prisma.webauthnChallenge.delete).toHaveBeenCalledWith({
        where: { id: "row-1" },
      });
    });

    it("throws when the stored challenge has expired, and still deletes it", async () => {
      prisma.webauthnChallenge.findUnique.mockResolvedValue({
        id: "row-1",
        challenge: "chal-abc",
        expiresAt: new Date(Date.now() - 60_000),
      });

      await expect(
        service.consume("user-1", WebauthnChallengeType.REGISTRATION),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.webauthnChallenge.delete).toHaveBeenCalledWith({
        where: { id: "row-1" },
      });
    });

    it("is single-use: consuming twice in a row fails the second time (replay protection)", async () => {
      // First call: the row is present (as `save` would have left it).
      prisma.webauthnChallenge.findUnique.mockResolvedValueOnce({
        id: "row-1",
        challenge: "chal-abc",
        expiresAt: new Date(Date.now() + 60_000),
      });
      // Second call: the row was deleted by the first `consume()` — a real DB
      // would return null here too, since `delete` already ran.
      prisma.webauthnChallenge.findUnique.mockResolvedValueOnce(null);

      const first = await service.consume(
        "user-1",
        WebauthnChallengeType.AUTHENTICATION,
      );
      expect(first).toBe("chal-abc");

      await expect(
        service.consume("user-1", WebauthnChallengeType.AUTHENTICATION),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.webauthnChallenge.delete).toHaveBeenCalledTimes(1);
    });
  });
});
