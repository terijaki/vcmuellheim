import type { Handler } from "aws-lambda";
import * as Sentry from "@sentry/aws-serverless";
import { Sentry as SentryConfig } from "@/project.config";

const sentryEnvironment = process.env.CDK_ENVIRONMENT ?? "dev";

// Initialize Sentry at module load time (cold start)
Sentry.init({
  dsn: SentryConfig.dsn,
  environment: sentryEnvironment,
  enabled: Boolean(SentryConfig.dsn),
  tracesSampleRate: 0.2,
  // Auto-capture uncaught exceptions and unhandled rejections
  integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
  beforeSend(event) {
    // Suppress the specific DEP0169 url.parse() deprecation warning from third-party
    // dependencies (e.g. h3/Nitro) that we can't fix ourselves
    if (event.message?.includes("DEP0169")) return null;
    return event;
  },
});

export function wrapLambdaHandler<T extends Handler>(handler: T): T {
  return Sentry.wrapHandler(handler, { captureTimeoutWarning: true }) as T;
}

export { Sentry };
