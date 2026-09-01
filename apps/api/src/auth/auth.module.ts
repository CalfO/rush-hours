import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthGuard } from "./auth.guard";
import { ChallengeStoreService } from "./challenge-store.service";
import { SessionService } from "./session.service";
import { WebauthnService } from "./webauthn.service";

/**
 * `PrismaModule`/`ConfigModule` are `@Global()` already (see `CLAUDE.md`), so they
 * don't need to be re-imported here. `AuthGuard` is registered as the app-wide
 * `APP_GUARD` from this feature module — standard Nest pattern, see
 * nestjs-best-practices.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET"),
        signOptions: { expiresIn: "7d" },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    WebauthnService,
    ChallengeStoreService,
    SessionService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
