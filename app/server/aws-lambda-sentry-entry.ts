import "#nitro/virtual/polyfills";
import type { StreamifyHandler } from "aws-lambda";
import "aws-lambda";
import { wrapHandler } from "@sentry/aws-serverless";
import { handleLambdaEventWithStream } from "srvx/aws-lambda";
import { useNitroApp } from "nitro/app";

const nitroApp = useNitroApp();

const streamHandler: StreamifyHandler = (event, responseStream, context) =>
  handleLambdaEventWithStream(nitroApp.fetch, event, responseStream, context);

const rawHandler = awslambda.streamifyResponse(streamHandler);

export const handler = wrapHandler(rawHandler, { captureTimeoutWarning: true });
