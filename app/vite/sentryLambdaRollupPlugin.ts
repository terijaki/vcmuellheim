type RollupOutputChunk = {
  type: string;
  fileName: string;
  code: string;
};

/**
 * Wraps the Nitro aws-lambda streaming handler export with Sentry's Lambda wrapper
 * (timeout warnings and unhandled errors) without replacing TanStack Start Sentry init.
 */
const sentryImport = `import { wrapHandler as __vcmSentryWrapHandler } from "@sentry/aws-serverless";`;

export function wrapNitroLambdaHandlerSource(source: string): string {
  if (source.includes("__vcmSentryWrapHandler") || source.includes("__vcmRawLambdaHandler")) {
    return source;
  }

  if (/^export const handler = /m.test(source)) {
    return source.replace(
      /^export const handler = (.+);$/m,
      `${sentryImport}
export const handler = __vcmSentryWrapHandler($1, { captureTimeoutWarning: true });`,
    );
  }

  if (source.includes("async function handler(") && source.includes("export { handler }")) {
    return source
      .replace("async function handler(", "async function __vcmRawLambdaHandler(")
      .replace(
        "export { handler };",
        `${sentryImport}
const handler = __vcmSentryWrapHandler(__vcmRawLambdaHandler, { captureTimeoutWarning: true });
export { handler };`,
      );
  }

  return source;
}

export function sentryLambdaRollupPlugin() {
  return {
    name: "vcm-sentry-lambda-wrap",
    generateBundle(
      _outputOptions: unknown,
      bundle: Record<string, RollupOutputChunk | { type: string }>,
    ) {
      for (const file of Object.values(bundle)) {
        if (file.type !== "chunk") continue;
        const chunk = file as RollupOutputChunk;
        if (!chunk.fileName.endsWith("index.mjs")) continue;
        chunk.code = wrapNitroLambdaHandlerSource(chunk.code);
      }
    },
  };
}
