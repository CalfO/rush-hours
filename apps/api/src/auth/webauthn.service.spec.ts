import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { WebauthnService } from "./webauthn.service";

/**
 * Spec traceability — `prompts/spec/rushhours-full-spec.md` §5.2 (the WebAuthn
 * ceremonies exposed by the endpoints table).
 *
 * Unlike `auth.service.spec.ts`, this suite does NOT mock `WebauthnService`
 * itself — it exercises the real `@simplewebauthn/server` calls
 * (`generateRegistrationOptions`/`generateAuthenticationOptions`/
 * `verifyRegistrationResponse`/`verifyAuthenticationResponse`). The reviewer
 * flagged that every other test mocks this boundary, so nothing actually
 * proves the library resolves/executes correctly at runtime (it ships both
 * ESM and CJS builds — a resolution regression there would not be caught by
 * a mocked unit test or by an e2e suite that also stubs `WebauthnService`).
 *
 * `verifyRegistrationResponse`/`verifyAuthenticationResponse` cannot be driven
 * to a *successful* verification here without a real authenticator producing
 * genuine signed attestation/assertion bytes (out of reach for a unit test) —
 * so those two only assert on the failure path (malformed input is rejected),
 * which is enough to prove the real library is reachable, invoked, and still
 * throws/validates as expected rather than being silently bypassed.
 */
describe("WebauthnService (real @simplewebauthn/server, no crypto mocked)", () => {
  let service: WebauthnService;

  const RP_ID = "example.org";
  const ORIGIN = "https://example.org";

  beforeEach(async () => {
    const config: Pick<ConfigService, "get"> = {
      get: (key: string) => {
        if (key === "WEBAUTHN_RP_ID") return RP_ID;
        if (key === "WEBAUTHN_ORIGIN") return ORIGIN;
        return undefined;
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebauthnService,
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get(WebauthnService);
  });

  describe("generateRegistrationOptions", () => {
    it("returns real creation options scoped to the configured rpID and given user", async () => {
      const options = await service.generateRegistrationOptions(
        "user-1",
        "alice",
      );

      expect(options.rp.id).toBe(RP_ID);
      expect(options.user.name).toBe("alice");
      expect(typeof options.challenge).toBe("string");
      expect(options.challenge.length).toBeGreaterThan(0);
      expect(options.pubKeyCredParams.length).toBeGreaterThan(0);
    });

    it("excludes the credentials passed as excludeCredentials", async () => {
      const options = await service.generateRegistrationOptions(
        "user-1",
        "alice",
        [{ id: "already-registered-cred", transports: ["internal"] }],
      );

      expect(options.excludeCredentials).toEqual([
        expect.objectContaining({ id: "already-registered-cred" }) as object,
      ]);
    });
  });

  describe("generateAuthenticationOptions", () => {
    it("returns real request options scoped to the configured rpID and allowCredentials", async () => {
      const options = await service.generateAuthenticationOptions([
        { id: "cred-abc", transports: ["internal"] },
      ]);

      expect(options.rpId).toBe(RP_ID);
      expect(typeof options.challenge).toBe("string");
      expect(options.challenge.length).toBeGreaterThan(0);
      expect(options.allowCredentials).toEqual([
        expect.objectContaining({ id: "cred-abc" }) as object,
      ]);
    });
  });

  describe("verifyRegistrationResponse", () => {
    it("rejects a malformed attestation response instead of silently succeeding", async () => {
      const garbage = {} as unknown as RegistrationResponseJSON;

      await expect(
        service.verifyRegistrationResponse(garbage, "some-challenge"),
      ).rejects.toThrow();
    });
  });

  describe("verifyAuthenticationResponse", () => {
    it("rejects a malformed assertion response instead of silently succeeding", async () => {
      const garbage = {} as unknown as AuthenticationResponseJSON;

      await expect(
        service.verifyAuthenticationResponse(garbage, "some-challenge", {
          id: "cred-abc",
          publicKey: new Uint8Array([1, 2, 3]),
          counter: 0,
        }),
      ).rejects.toThrow();
    });
  });
});
