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
/**
 * A real `attestationResponse` captured from a browser passkey registration
 * (see `verifyRegistrationResponse`'s "user presence only" test below) —
 * genuine signed bytes, not synthesized. The RP ID/origin it was signed
 * against are baked into `clientDataJSON`/`authenticatorData`, so it can
 * only be verified against that exact origin (see the dedicated
 * `WebauthnService` instance constructed for that test).
 */
const NO_UV_REGISTRATION_RESPONSE: RegistrationResponseJSON = {
  id: "jFay67pGCRKKrdO0X8OCBw",
  rawId: "jFay67pGCRKKrdO0X8OCBw",
  response: {
    attestationObject:
      "o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YViUjIaCeEMALkcNr4QxDKsjCfWcrdXI8DdVuDdmoW_jx7NZAAAAAOqbjWZNAR0hPOS2tIy1ddQAEIxWsuu6RgkSiq3TtF_DggelAQIDJiABIVggvCdT9LSpXS0s4ZyU1uPBJdjSTIJT1o06reIy3YNzGLoiWCB6nXjTvTIQv3z25smhTYVv8nP-OiQEF8BsMH5xtjDzhA",
    clientDataJSON:
      "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoiWHR6ME1DZXBXSlpxZmt6MEZyeWJJSk9JZzdLdi1aaUE3QkJMampCMDBGYyIsIm9yaWdpbiI6Imh0dHBzOi8vZ2xvd2luZy1hZHZlbnR1cmUtNzQ0cDZwdmd3Z2ZycjRnLTMwMDAuYXBwLmdpdGh1Yi5kZXYiLCJjcm9zc09yaWdpbiI6ZmFsc2UsIm90aGVyX2tleXNfY2FuX2JlX2FkZGVkX2hlcmUiOiJkbyBub3QgY29tcGFyZSBjbGllbnREYXRhSlNPTiBhZ2FpbnN0IGEgdGVtcGxhdGUuIFNlZSBodHRwczovL2dvby5nbC95YWJQZXgifQ",
    transports: ["hybrid", "internal"],
    publicKeyAlgorithm: -7,
    publicKey:
      "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEvCdT9LSpXS0s4ZyU1uPBJdjSTIJT1o06reIy3YNzGLp6nXjTvTIQv3z25smhTYVv8nP-OiQEF8BsMH5xtjDzhA",
    authenticatorData:
      "jIaCeEMALkcNr4QxDKsjCfWcrdXI8DdVuDdmoW_jx7NZAAAAAOqbjWZNAR0hPOS2tIy1ddQAEIxWsuu6RgkSiq3TtF_DggelAQIDJiABIVggvCdT9LSpXS0s4ZyU1uPBJdjSTIJT1o06reIy3YNzGLoiWCB6nXjTvTIQv3z25smhTYVv8nP-OiQEF8BsMH5xtjDzhA",
  },
  type: "public-key",
  clientExtensionResults: { credProps: { rk: true } },
  authenticatorAttachment: "platform",
};

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

    /**
     * Regression test for a real ceremony captured from a browser passkey
     * registration that saved the credential to a password manager without
     * a PIN/biometric prompt (the authenticator sets the "user present" (UP)
     * flag but not "user verified" (UV) — legitimate under the "preferred"
     * userVerification policy `generateRegistrationOptions` above requests).
     * `@simplewebauthn/server@13`'s `verifyRegistrationResponse` defaults
     * `requireUserVerification` to `true` regardless of what the options
     * actually asked for, so this real, otherwise-fully-valid response used
     * to fail with "User verification was required, but user could not be
     * verified" — a legitimate registration rejected as a generic 401.
     * `webauthn.service.ts` now passes `requireUserVerification: false`
     * explicitly to match the "preferred" policy; this asserts against the
     * real captured bytes (signature and all) rather than a mock, so a
     * regression here — e.g. an upstream default change, or someone
     * "cleaning up" the explicit flag — is caught by an actual failed
     * cryptographic verification, not just a changed function argument.
     */
    it("accepts a real registration response where the authenticator only asserts user presence, not user verification", async () => {
      const capturedOrigin =
        "https://glowing-adventure-744p6pvgwgfrr4g-3000.app.github.dev";
      const capturedRpId =
        "glowing-adventure-744p6pvgwgfrr4g-3000.app.github.dev";
      const capturedConfig: Pick<ConfigService, "get"> = {
        get: (key: string) => {
          if (key === "WEBAUTHN_RP_ID") return capturedRpId;
          if (key === "WEBAUTHN_ORIGIN") return capturedOrigin;
          return undefined;
        },
      };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          WebauthnService,
          { provide: ConfigService, useValue: capturedConfig },
        ],
      }).compile();
      const serviceForCapturedOrigin = module.get(WebauthnService);

      const response = NO_UV_REGISTRATION_RESPONSE;
      const clientDataJSON = JSON.parse(
        Buffer.from(response.response.clientDataJSON, "base64url").toString(),
      ) as { challenge: string };

      const result = await serviceForCapturedOrigin.verifyRegistrationResponse(
        response,
        clientDataJSON.challenge,
      );

      expect(result.verified).toBe(true);
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
