import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { usernameSchema } from "./username.dto";

/**
 * `assertionResponse` is the `AuthenticationResponseJSON` produced by
 * `@simplewebauthn/browser`'s `startAuthentication()` — see the note in
 * `register-verify.dto.ts` on why only the object shape is asserted here.
 */
export const loginVerifySchema = usernameSchema.extend({
  assertionResponse: z.record(z.string(), z.unknown()),
});

export class LoginVerifyDto extends createZodDto(loginVerifySchema) {}
