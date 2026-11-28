import { afterEach, describe, expect, it, vi } from "vitest";
import { createLambdaLogger } from "./logger";

describe("createLambdaLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs JSON with level, service, and message when extra is omitted", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = createLambdaLogger("test-service");

    logger.info("hello");

    expect(infoSpy).toHaveBeenCalledOnce();
    expect(JSON.parse(String(infoSpy.mock.calls[0]?.[0]))).toEqual({
      level: "info",
      service: "test-service",
      message: "hello",
    });
  });

  it("merges extra fields into the JSON payload", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createLambdaLogger("worker");

    logger.error("failed", { code: 500, retry: true });

    expect(JSON.parse(String(errorSpy.mock.calls[0]?.[0]))).toEqual({
      level: "error",
      service: "worker",
      message: "failed",
      code: 500,
      retry: true,
    });
  });

  it("serializes Error values in extra with name, message, and stack", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createLambdaLogger("worker");
    const boom = new Error("boom");
    boom.stack = "Error: boom\n    at test";

    logger.error("caught", { error: boom });

    const payload = JSON.parse(String(errorSpy.mock.calls[0]?.[0])) as {
      error: { name: string; message: string; stack: string };
    };
    expect(payload.error.name).toBe("Error");
    expect(payload.error.message).toBe("boom");
    expect(payload.error.stack).toBe("Error: boom\n    at test");
  });
});
