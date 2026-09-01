import { Body, Controller, Get, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { AuthService } from "./auth.service";
import { SESSION_COOKIE_NAME, SessionService } from "./session.service";
import { Public } from "./decorators/public.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";
import { UsernameDto } from "./dto/username.dto";
import { RegisterVerifyDto } from "./dto/register-verify.dto";
import { LoginVerifyDto } from "./dto/login-verify.dto";
import type { SessionPayload } from "./session-payload.interface";

/** §5.2 — all routes public except `/auth/me` (guarded globally by `AuthGuard`). */
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
  ) {}

  @Public()
  @Post("webauthn/register/options")
  registerOptions(@Body() body: UsernameDto) {
    return this.authService.getRegistrationOptions(body.username);
  }

  @Public()
  @Post("webauthn/register/verify")
  async registerVerify(
    @Body() body: RegisterVerifyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = await this.authService.verifyRegistration(
      body.username,
      body.attestationResponse as unknown as RegistrationResponseJSON,
    );
    res.cookie(
      SESSION_COOKIE_NAME,
      token,
      this.sessionService.getCookieOptions(),
    );
    return { verified: true };
  }

  @Public()
  @Post("webauthn/login/options")
  loginOptions(@Body() body: UsernameDto) {
    return this.authService.getLoginOptions(body.username);
  }

  @Public()
  @Post("webauthn/login/verify")
  async loginVerify(
    @Body() body: LoginVerifyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = await this.authService.verifyLogin(
      body.username,
      body.assertionResponse as unknown as AuthenticationResponseJSON,
    );
    res.cookie(
      SESSION_COOKIE_NAME,
      token,
      this.sessionService.getCookieOptions(),
    );
    return { verified: true };
  }

  @Public()
  @Post("logout")
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    return { success: true };
  }

  @Get("me")
  me(@CurrentUser() user: SessionPayload) {
    return this.authService.getMe(user.sub);
  }
}
