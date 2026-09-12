import type { Context, Handler } from "aws-lambda";
import { pathToFileURL } from "node:url";

const RUNTIME_API_VERSION = "2018-06-01";

export function parseHandlerName(handlerName: string): { fileName: string; exportName: string } {
  const separator = handlerName.lastIndexOf(".");
  if (separator <= 0 || separator === handlerName.length - 1) {
    throw new Error(`Invalid Lambda handler "${handlerName}". Expected "file.export".`);
  }
  return {
    fileName: handlerName.slice(0, separator),
    exportName: handlerName.slice(separator + 1),
  };
}

export function runtimeBaseUrl(runtimeApi = process.env.AWS_LAMBDA_RUNTIME_API): string {
  if (!runtimeApi) {
    throw new Error("AWS_LAMBDA_RUNTIME_API is not set");
  }
  return `http://${runtimeApi}/${RUNTIME_API_VERSION}`;
}

export function createLambdaContext(headers: Headers, now = Date.now()): Context {
  const deadlineMs = Number(headers.get("Lambda-Runtime-Deadline-Ms") ?? "0") || now;
  const requestId = headers.get("Lambda-Runtime-Aws-Request-Id") ?? "";
  const functionArn = headers.get("Lambda-Runtime-Invoked-Function-Arn") ?? "";

  return {
    callbackWaitsForEmptyEventLoop: true,
    functionName: process.env.AWS_LAMBDA_FUNCTION_NAME ?? "",
    functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION ?? "$LATEST",
    invokedFunctionArn: functionArn,
    memoryLimitInMB: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE ?? "128",
    awsRequestId: requestId,
    logGroupName: process.env.AWS_LAMBDA_LOG_GROUP_NAME ?? "",
    logStreamName: process.env.AWS_LAMBDA_LOG_STREAM_NAME ?? "",
    getRemainingTimeInMillis: () => Math.max(0, deadlineMs - Date.now()),
    done: () => undefined,
    fail: () => undefined,
    succeed: () => undefined,
  };
}

export async function loadHandler(
  taskRoot: string,
  handlerName: string,
): Promise<Handler<unknown, unknown>> {
  const { fileName, exportName } = parseHandlerName(handlerName);
  const moduleUrl = pathToFileURL(`${taskRoot}/${fileName}.js`).href;
  const mod: Record<string, unknown> = await import(moduleUrl);
  const handler = mod[exportName];
  if (!isLambdaHandler(handler)) {
    throw new Error(`${fileName}.js does not export a function named "${exportName}"`);
  }
  return handler;
}

function isLambdaHandler(value: unknown): value is Handler<unknown, unknown> {
  return typeof value === "function";
}

function lambdaErrorBody(error: unknown): string {
  if (error instanceof Error) {
    return JSON.stringify({
      errorType: error.name,
      errorMessage: error.message,
      stackTrace: error.stack?.split("\n"),
    });
  }
  return JSON.stringify({
    errorType: "Error",
    errorMessage: String(error),
  });
}

export async function postInitError(baseUrl: string, error: unknown): Promise<void> {
  await fetch(`${baseUrl}/runtime/init/error`, {
    method: "POST",
    headers: {
      "Content-Type": "application/vnd.aws.lambda.error+json",
    },
    body: lambdaErrorBody(error),
  });
}

export async function handleInvocation(
  baseUrl: string,
  handler: Handler<unknown, unknown>,
): Promise<void> {
  const next = await fetch(`${baseUrl}/runtime/invocation/next`);
  if (!next.ok) {
    throw new Error(`Runtime next failed: ${next.status} ${next.statusText}`);
  }

  const requestId = next.headers.get("Lambda-Runtime-Aws-Request-Id");
  if (!requestId) {
    throw new Error("Runtime received a request without a request ID");
  }

  const traceId = next.headers.get("Lambda-Runtime-Trace-Id");
  if (traceId) {
    process.env._X_AMZN_TRACE_ID = traceId;
  }

  const event: unknown = await next.json();
  const context = createLambdaContext(next.headers);

  try {
    const result = await handler(event, context, () => undefined);
    await fetch(`${baseUrl}/runtime/invocation/${requestId}/response`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result ?? null),
    });
  } catch (error) {
    await fetch(`${baseUrl}/runtime/invocation/${requestId}/error`, {
      method: "POST",
      headers: { "Content-Type": "application/vnd.aws.lambda.error+json" },
      body: lambdaErrorBody(error),
    });
  }
}

export async function startLambdaRuntime(): Promise<void> {
  const baseUrl = runtimeBaseUrl();
  let handler: Handler<unknown, unknown>;
  try {
    const taskRoot = process.env.LAMBDA_TASK_ROOT;
    const handlerName = process.env._HANDLER;
    if (!taskRoot || !handlerName) {
      throw new Error("LAMBDA_TASK_ROOT and _HANDLER must be set");
    }
    handler = await loadHandler(taskRoot, handlerName);
  } catch (error) {
    await postInitError(baseUrl, error);
    throw error;
  }

  for (;;) {
    await handleInvocation(baseUrl, handler);
  }
}

if (process.argv[1]?.endsWith("runtime.ts") || process.argv[1]?.endsWith("runtime.js")) {
  startLambdaRuntime().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
