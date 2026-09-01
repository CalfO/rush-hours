import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { CookieOptions } from "express";
import { SessionPayload } from "./session-payload.interface";

export const SESSION_COOKIE_NAME = "rushhours_session";

/** Keep in sync with `JwtModule.registerAsync`'s `signOptions.expiresIn` in `auth.module.ts`. */
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Signs/verifies the session JWT and centralizes the httpOnly session cookie's
 * options (spec §2: "JWT signé stocké dans un cookie httpOnly, SameSite=Lax").
 */
@Injectable()
export class SessionService {
  constructor(private readonly jwtService: JwtService) {}

  sign(payload: SessionPayload): Promise<string> {
    return this.jwtService.signAsync(payload);
  }

  verify(token: string): Promise<SessionPayload> {
    return this.jwtService.verifyAsync<SessionPayload>(token);
  }

  getCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_MS,
    };
  }
}
