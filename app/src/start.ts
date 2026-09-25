import {
  sentryGlobalFunctionMiddleware,
  sentryGlobalRequestMiddleware,
} from "@sentry/tanstackstart-react";
import { createMiddleware, createStart } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { publicHomeCacheControl } from "./lib/public-document-cache";

const publicHomeCacheMiddleware = createMiddleware().server(async ({ next, request }) => {
  const result = await next();
  const url = new URL(request.url);
  const cacheControl = publicHomeCacheControl(
    request.method,
    url.pathname,
    request.headers.get("cookie"),
  );
  if (cacheControl) setResponseHeader("Cache-Control", cacheControl);
  return result;
});

export const startInstance = createStart(() => {
  return {
    requestMiddleware: [sentryGlobalRequestMiddleware, publicHomeCacheMiddleware],
    functionMiddleware: [sentryGlobalFunctionMiddleware],
  };
});
