import * as Sentry from "@sentry/aws-serverless";

// Initialize Sentry at module load time (cold start)
Sentry.init({
	dsn: "https://fa39728bab836eac8258598505b891fe@o4509428230979584.ingest.de.sentry.io/4509428234322000",
	environment: process.env.NODE_ENV || "development",
	enabled: process.env.NODE_ENV === "production",
	tracesSampleRate: 0.2,
	// Auto-capture uncaught exceptions and unhandled rejections
	integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
});

export { Sentry };
