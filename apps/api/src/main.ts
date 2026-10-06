import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";

async function bootstrap() {
  // bufferLogs so nothing logged during bootstrap is lost before useLogger below.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  // No signing secret: the WebAuthn challenge is stored server-side (DB), not in a
  // signed cookie — see challenge-store.service.ts.
  app.use(cookieParser());
  // credentials: true is required so the httpOnly session cookie is sent/received
  // on cross-origin requests (see CLAUDE.md's Codespaces CORS note for why the dev
  // proxy keeps calls same-origin regardless — this still matters for direct access).
  app.enableCors({ origin: true, credentials: true });
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
