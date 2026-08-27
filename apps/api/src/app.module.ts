import { Module } from "@nestjs/common";
import { APP_PIPE } from "@nestjs/core";
import { ZodValidationPipe } from "nestjs-zod";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./prisma/prisma.module";
import { ConfigModule } from "./config/config.module";
import { LoggerModule } from "./logger/logger.module";
import { AuthModule } from "./auth/auth.module";

@Module({
  imports: [ConfigModule, LoggerModule, PrismaModule, AuthModule],
  controllers: [AppController],
  providers: [
    AppService,
    // Validates every nestjs-zod DTO across the app (spec §2: Zod front+back) —
    // see nestjs-best-practices §4.
    { provide: APP_PIPE, useClass: ZodValidationPipe },
  ],
})
export class AppModule {}
