import * as Sentry from "@sentry/aws-serverless";
import { Sentry as SentryConfig } from "@/project.config";

const sentryEnvironment = process.env.CDK_ENVIRONMENT || process.env.NODE_ENV || "development";

// Initialize Sentry at module load time (cold start)
Sentry.init({
	dsn: SentryConfig.dsn,
	environment: sentryEnvironment,
	enabled: Boolean(SentryConfig.dsn),
	tracesSampleRate: 0.2,
	// Auto-capture uncaught exceptions and unhandled rejections
	integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
});

export { Sentry };
