import { Module } from "@nestjs/common";
import { LoggerModule as NestjsPinoLoggerModule } from "nestjs-pino";

@Module({
  imports: [
    NestjsPinoLoggerModule.forRootAsync({
      useFactory: () => ({
        pinoHttp: {
          transport:
            process.env.NODE_ENV !== "production"
              ? { target: "pino-pretty" }
              : undefined,
          redact: [
            "req.headers.cookie",
            "req.headers.authorization",
            'res.headers["set-cookie"]',
          ],
        },
      }),
    }),
  ],
})
export class LoggerModule {}
