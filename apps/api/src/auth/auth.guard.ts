import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { IS_PUBLIC_KEY } from "./decorators/public.decorator";
import { SESSION_COOKIE_NAME, SessionService } from "./session.service";
import { SessionPayload } from "./session-payload.interface";

/**
 * Global guard (registered via `APP_GUARD` in `AuthModule`) — reads the session
 * cookie, verifies it, and attaches the payload to `req.user` for `@CurrentUser()`.
 * Routes/controllers marked `@Public()` skip this entirely.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: SessionPayload }>();
    // cookie-parser types `req.cookies` as `any` — narrow it explicitly.
    const token = request.cookies?.[SESSION_COOKIE_NAME] as string | undefined;

    if (!token) {
      throw new UnauthorizedException("No session cookie");
    }

    try {
      const payload: SessionPayload = await this.sessionService.verify(token);
      request.user = payload;
    } catch {
      throw new UnauthorizedException("Invalid or expired session");
    }

    return true;
  }
}
