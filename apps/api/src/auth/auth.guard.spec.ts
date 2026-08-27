import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "./auth.guard";
import { SessionService } from "./session.service";
import { SESSION_COOKIE_NAME } from "./session.service";
import { Role } from "@prisma/client";

/**
 * Spec traceability — §5.2: "Toutes protégées par le guard de session (sauf
 * /auth/*)" (§6) and the `@Public()` opt-out used by the WebAuthn ceremony
 * endpoints/`logout` themselves (§5.2 table). Guard logic is pure enough to unit
 * test directly without booting a Nest app.
 */
describe("AuthGuard", () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let sessionService: { verify: jest.Mock };
  let guard: AuthGuard;

  function makeContext(cookies: Record<string, string> = {}): {
    context: ExecutionContext;
    request: { cookies: Record<string, string>; user?: unknown };
  } {
    const request: { cookies: Record<string, string>; user?: unknown } = {
      cookies,
    };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
    return { context, request };
  }

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    sessionService = { verify: jest.fn() };
    guard = new AuthGuard(
      reflector as unknown as Reflector,
      sessionService as unknown as SessionService,
    );
  });

  it("lets a @Public() route through without inspecting the cookie", async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const { context } = makeContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(sessionService.verify).not.toHaveBeenCalled();
  });

  it("throws 401 on a protected route with no session cookie", async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const { context } = makeContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("throws 401 on a protected route when the session cookie fails verification", async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    sessionService.verify.mockRejectedValue(new Error("expired"));
    const { context } = makeContext({ [SESSION_COOKIE_NAME]: "bad.token" });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("attaches the verified session payload to the request and allows access", async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const payload = { sub: "user-1", username: "user", role: Role.USER };
    sessionService.verify.mockResolvedValue(payload);
    const { context, request } = makeContext({
      [SESSION_COOKIE_NAME]: "good.token",
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(payload);
  });
});
