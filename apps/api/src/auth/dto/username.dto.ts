import { createZodDto } from "nestjs-zod";
import { z } from "zod";

/**
 * Shared by the WebAuthn register/options and login/options endpoints — both take
 * only a `username` in their request body (see spec §5.2).
 */
export const usernameSchema = z.object({
  username: z.string().min(1),
});

export class UsernameDto extends createZodDto(usernameSchema) {}
