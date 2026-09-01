import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { usernameSchema } from "./username.dto";

/**
 * `attestationResponse` is the `RegistrationResponseJSON` produced by
 * `@simplewebauthn/browser`'s `startRegistration()` — its exact shape is deep and
 * authenticator-dependent, so we only assert it's an object here and let
 * `@simplewebauthn/server`'s `verifyRegistrationResponse` (the actual authority on
 * this payload) reject anything malformed.
 */
export const registerVerifySchema = usernameSchema.extend({
  attestationResponse: z.record(z.string(), z.unknown()),
});

export class RegisterVerifyDto extends createZodDto(registerVerifySchema) {}
