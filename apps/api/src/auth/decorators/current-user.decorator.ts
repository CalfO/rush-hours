import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { SessionPayload } from "../session-payload.interface";

/**
 * Reads the session payload `AuthGuard` attached to `req.user` after verifying the
 * session cookie. Only meaningful on routes not marked `@Public()`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionPayload => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: SessionPayload }>();
    return request.user;
  },
);
