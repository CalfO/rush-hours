import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  WEBAUTHN_RP_ID: z.string().min(1),
  WEBAUTHN_ORIGIN: z.string().min(1),
  JWT_SECRET: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;
