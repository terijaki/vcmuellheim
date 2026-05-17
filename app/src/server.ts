import "./instrument.server";
import * as Sentry from "@sentry/tanstackstart-react";
import { createServerEntry, default as handler } from "@tanstack/react-start/server-entry";

export default createServerEntry(
  Sentry.wrapFetchWithSentry({
    fetch(request: Request) {
      return handler.fetch(request);
    },
  }),
);
