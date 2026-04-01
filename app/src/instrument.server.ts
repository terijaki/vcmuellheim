import { Sentry as SentryConfig } from "@project.config";
import * as Sentry from "@sentry/tanstackstart-react";

if (!Sentry.getClient()) {
	Sentry.init({
		dsn: SentryConfig.dsn,
		enabled: Boolean(SentryConfig.dsn),
		environment: process.env.CDK_ENVIRONMENT || process.env.NODE_ENV || "development",
	});
}
