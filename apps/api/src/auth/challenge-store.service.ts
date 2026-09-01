import { Injectable, UnauthorizedException } from "@nestjs/common";
import { WebauthnChallengeType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/** WebAuthn challenges are short-lived — only need to survive one ceremony round-trip. */
const CHALLENGE_TTL_MS = 2 * 60 * 1000;

@Injectable()
export class ChallengeStoreService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persists (or replaces) the pending challenge for this user/type pair. A user can
   * only have one in-flight challenge per ceremony type at a time, matching the
   * `@@unique([userId, type])` constraint on `WebauthnChallenge`.
   */
  async save(
    userId: string,
    type: WebauthnChallengeType,
    challenge: string,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
    await this.prisma.webauthnChallenge.upsert({
      where: { userId_type: { userId, type } },
      update: { challenge, expiresAt },
      create: { userId, type, challenge, expiresAt },
    });
  }

  /**
   * Reads and deletes the pending challenge in one go (single-use — a WebAuthn
   * challenge must never be verifiable twice, that's what makes it a challenge).
   * Throws if there is no pending challenge, or if it expired.
   */
  async consume(userId: string, type: WebauthnChallengeType): Promise<string> {
    const record = await this.prisma.webauthnChallenge.findUnique({
      where: { userId_type: { userId, type } },
    });

    if (!record) {
      throw new UnauthorizedException("No pending WebAuthn challenge");
    }

    await this.prisma.webauthnChallenge.delete({ where: { id: record.id } });

    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("WebAuthn challenge has expired");
    }

    return record.challenge;
  }
}
