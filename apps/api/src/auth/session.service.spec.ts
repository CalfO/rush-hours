import { Test, TestingModule } from "@nestjs/testing";
import { JwtModule } from "@nestjs/jwt";
import { Role } from "@prisma/client";
import { SessionService } from "./session.service";

/**
 * Spec traceability — §2 "Session applicative": "l'API émet un JWT signé stocké
 * dans un cookie httpOnly, SameSite=Lax". Uses a real `JwtModule` (fast, pure
 * crypto, no DB) rather than mocking `JwtService`, so the sign/verify round trip
 * is genuinely exercised.
 */
describe("SessionService", () => {
  let service: SessionService;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: "test-secret",
          signOptions: { expiresIn: "7d" },
        }),
      ],
      providers: [SessionService],
    }).compile();

    service = module.get(SessionService);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("signs a payload and verifies it back to the same values", async () => {
    const payload = { sub: "user-1", username: "user", role: Role.USER };

    const token = await service.sign(payload);
    const decoded = await service.verify(token);

    expect(decoded).toMatchObject(payload);
  });

  it("rejects a tampered/invalid token", async () => {
    await expect(service.verify("not-a-real-jwt")).rejects.toBeDefined();
  });

  describe("getCookieOptions", () => {
    it("is httpOnly with SameSite=Lax (§2 imposed choice)", () => {
      const options = service.getCookieOptions();

      expect(options.httpOnly).toBe(true);
      expect(options.sameSite).toBe("lax");
      expect(options.path).toBe("/");
    });

    it("is not marked secure outside of production", () => {
      process.env.NODE_ENV = "development";

      expect(service.getCookieOptions().secure).toBe(false);
    });

    it("is marked secure in production", () => {
      process.env.NODE_ENV = "production";

      expect(service.getCookieOptions().secure).toBe(true);
    });
  });
});
