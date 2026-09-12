import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  createLambdaContext,
  handleInvocation,
  parseHandlerName,
  postInitError,
  runtimeBaseUrl,
} from "./runtime";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseHandlerName", () => {
  it("splits file and export", () => {
    expect(parseHandlerName("index.handler")).toEqual({
      fileName: "index",
      exportName: "handler",
    });
  });

  it("rejects names without a separator", () => {
    expect(() => parseHandlerName("handler")).toThrow("Invalid Lambda handler");
  });

  it("splits on the last separator so nested files work", () => {
    expect(parseHandlerName("dir/index.handler")).toEqual({
      fileName: "dir/index",
      exportName: "handler",
    });
  });
});

describe("runtimeBaseUrl", () => {
  it("builds the Runtime API base URL", () => {
    expect(runtimeBaseUrl("127.0.0.1:9001")).toBe("http://127.0.0.1:9001/2018-06-01");
  });

  it("throws when AWS_LAMBDA_RUNTIME_API is missing", () => {
    const previous = process.env.AWS_LAMBDA_RUNTIME_API;
    delete process.env.AWS_LAMBDA_RUNTIME_API;
    expect(() => runtimeBaseUrl()).toThrow("AWS_LAMBDA_RUNTIME_API");
    if (previous) process.env.AWS_LAMBDA_RUNTIME_API = previous;
  });
});

describe("createLambdaContext", () => {
  it("exposes request id and remaining time from Runtime API headers", () => {
    const headers = new Headers({
      "Lambda-Runtime-Aws-Request-Id": "req-1",
      "Lambda-Runtime-Invoked-Function-Arn": "arn:aws:lambda:eu-central-1:123:function:fn",
      "Lambda-Runtime-Deadline-Ms": String(Date.now() + 5_000),
    });
    const context = createLambdaContext(headers);
    expect(context.awsRequestId).toBe("req-1");
    expect(context.invokedFunctionArn).toContain("function:fn");
    expect(context.getRemainingTimeInMillis()).toBeGreaterThan(0);
  });
});

describe("handleInvocation", () => {
  it("posts the handler result to /response", async () => {
    const fetchMock = vi.fn(
      async (input: string | URL, _init?: { method?: string; body?: string }) => {
        const url = String(input);
        if (url.endsWith("/runtime/invocation/next")) {
          return new Response(JSON.stringify({ hello: "world" }), {
            headers: {
              "Lambda-Runtime-Aws-Request-Id": "req-1",
              "Lambda-Runtime-Deadline-Ms": String(Date.now() + 1_000),
              "Lambda-Runtime-Invoked-Function-Arn": "arn:fn",
            },
          });
        }
        return new Response(null, { status: 202 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await handleInvocation("http://runtime/2018-06-01", async (event) => ({ echo: event }));

    const responseCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes("/runtime/invocation/req-1/response"),
    );
    expect(responseCall).toBeDefined();
    expect(responseCall?.[1]?.body).toBe(JSON.stringify({ echo: { hello: "world" } }));
  });

  it("posts handler throws to /error", async () => {
    const fetchMock = vi.fn(
      async (input: string | URL, _init?: { method?: string; body?: string }) => {
        const url = String(input);
        if (url.endsWith("/runtime/invocation/next")) {
          return new Response("{}", {
            headers: {
              "Lambda-Runtime-Aws-Request-Id": "req-2",
              "Lambda-Runtime-Deadline-Ms": String(Date.now() + 1_000),
            },
          });
        }
        return new Response(null, { status: 202 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await handleInvocation("http://runtime/2018-06-01", async () => {
      throw new Error("boom");
    });

    const errorCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes("/runtime/invocation/req-2/error"),
    );
    expect(errorCall).toBeDefined();
    expect(String(errorCall?.[1]?.body)).toContain("boom");
  });
});

describe("postInitError", () => {
  it("reports init failures to the Runtime API", async () => {
    const fetchMock = vi.fn(async (_input: string | URL) => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    await postInitError("http://runtime/2018-06-01", new Error("missing handler"));
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/runtime/init/error");
  });
});
