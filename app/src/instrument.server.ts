import { Sentry as SentryConfig } from "@project.config";
import * as Sentry from "@sentry/tanstackstart-react";

const sentryEnvironment = process.env.CDK_ENVIRONMENT ?? "dev";

if (!Sentry.getClient()) {
  Sentry.init({
    dsn: SentryConfig.dsn,
    enabled: Boolean(SentryConfig.dsn) && Boolean(process.env.LAMBDA_TASK_ROOT),
    environment: sentryEnvironment,
  });
}
