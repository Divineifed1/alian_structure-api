import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import * as helmet from "helmet";
import { ConfigService } from "@nestjs/config";
import { logger } from "./config/logger";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { SanitizePipe } from "./common/pipes/sanitize.pipe";
import { createCorsConfig } from "./config/cors.config";
import { createHelmetConfig } from "./config/helmet.config";
import { setupSwagger } from "./config/swagger.config";
import * as Sentry from "@sentry/node";
import { initSentry } from "./config/sentry";
import { sentryBreadcrumbMiddleware } from "./common/middleware/sentry.middleware";

async function bootstrap() {
  initSentry();

  // Initialize tracing safely
  try {
    const { startTracing } = await import("./config/tracing");
    await startTracing();
    logger.info("Tracing initialized");
  } catch (error) {
    logger.warn({ error: error.message }, "Tracing skipped");
  }
  // Create app - we can't use ConfigService in the logger config yet because app isn't fully initialized
  const app = await NestFactory.create(AppModule, {
    logger: ["log", "error", "warn", "debug", "verbose"],
  });

  const configService = app.get(ConfigService);
  // Override logger level after app is initialized based on environment
  if (configService.get("NODE_ENV") === "production") {
    app.useLogger(["error", "warn"]);
  }

  // Initialize Sentry request and performance monitoring middleware
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
  app.use(sentryBreadcrumbMiddleware);

  // Security Headers - Helmet
  app.use(helmet.default(createHelmetConfig()));

  // Global configuration
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    // Sanitize first to strip XSS payloads before validation
    new SanitizePipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: configService.get("NODE_ENV") === "production",
      forbidUnknownValues: true,
    }),
  );

  // CORS configuration with stricter settings
  app.enableCors(createCorsConfig(configService));

  // Disable x-powered-by header
  app.getHttpAdapter().getInstance().disable("x-powered-by");

  // Swagger/OpenAPI Documentation Setup
  setupSwagger(app);

  const port = configService.get("PORT") as number;
  await app.listen(port);

  logger.info(`🚀 Application running on http://localhost:${port}/api/v1`);
  logger.info(
    `📚 API Documentation available at http://localhost:${port}/api/docs`,
  );
}

bootstrap().catch((error) => {
  logger.error({ error }, "Bootstrap failed");
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error: Error) => {
  if (Sentry.getCurrentHub().getClient()) {
    Sentry.captureException(error);
    Sentry.flush(2000).finally(() => {
      logger.error({ error }, "Uncaught Exception");
      process.exit(1);
    });
    return;
  }

  logger.error({ error }, "Uncaught Exception");
  process.exit(1);
});

process.on("unhandledRejection", (reason: any) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));

  if (Sentry.getCurrentHub().getClient()) {
    Sentry.captureException(error);
    Sentry.flush(2000).finally(() => {
      logger.error("Unhandled Rejection:", error.message, error.stack || "");
      process.exit(1);
    });
    return;
  }

  logger.error("Unhandled Rejection:", error.message, error.stack || "");
  process.exit(1);
});