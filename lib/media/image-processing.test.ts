import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  invokeImageProcessorAsync,
  isAllowedMediaS3Key,
  shouldProcessImageKey,
} from "./image-processing";

const lambdaMock = mockClient(LambdaClient);

describe("shouldProcessImageKey", () => {
  it("returns true for raster images at final keys", () => {
    expect(shouldProcessImageKey("members/abc-123.jpg")).toBe(true);
    expect(shouldProcessImageKey("teams/foo.png")).toBe(true);
    expect(shouldProcessImageKey("sponsors/logo.webp")).toBe(true);
    expect(shouldProcessImageKey("news/article.gif")).toBe(true);
    expect(shouldProcessImageKey("media/photo.gif")).toBe(true);
  });

  it("returns false for responsive variants", () => {
    expect(shouldProcessImageKey("members/abc-480w.jpg")).toBe(false);
    expect(shouldProcessImageKey("teams/foo-1200w.webp")).toBe(false);
    expect(shouldProcessImageKey("news/article-800w.jpg")).toBe(false);
  });

  it("returns false for non-raster files", () => {
    expect(shouldProcessImageKey("sponsors/logo.svg")).toBe(false);
    expect(shouldProcessImageKey("members/readme.txt")).toBe(false);
  });
});

describe("isAllowedMediaS3Key", () => {
  it("accepts keys under known media folders", () => {
    expect(isAllowedMediaS3Key("members/uuid.jpg")).toBe(true);
    expect(isAllowedMediaS3Key("teams/uuid.jpg")).toBe(true);
    expect(isAllowedMediaS3Key("sponsors/uuid.jpg")).toBe(true);
    expect(isAllowedMediaS3Key("news/uuid.jpg")).toBe(true);
    expect(isAllowedMediaS3Key("media/uuid.jpg")).toBe(true);
  });

  it("rejects keys outside media folders", () => {
    expect(isAllowedMediaS3Key("uploads/members/uuid.jpg")).toBe(false);
    expect(isAllowedMediaS3Key("other/uuid.jpg")).toBe(false);
  });
});

describe("invokeImageProcessorAsync", () => {
  beforeEach(() => {
    lambdaMock.reset();
    process.env.IMAGE_PROCESSOR_FUNCTION_NAME = "vcm-bun-image-processor-dev";
    process.env.CDK_ENVIRONMENT = "dev";
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, "IMAGE_PROCESSOR_FUNCTION_NAME");
    Reflect.deleteProperty(process.env, "CDK_ENVIRONMENT");
  });

  it("invokes Lambda with bucket and key payload", async () => {
    lambdaMock.on(InvokeCommand).resolves({ StatusCode: 202 });

    await invokeImageProcessorAsync("test-bucket", "members/uuid.jpg");

    const calls = lambdaMock.commandCalls(InvokeCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args[0].input).toMatchObject({
      FunctionName: "vcm-bun-image-processor-dev",
      InvocationType: "Event",
    });
    expect(JSON.parse(String(calls[0]?.args[0].input.Payload))).toEqual({
      bucket: "test-bucket",
      key: "members/uuid.jpg",
    });
  });

  it("throws when StatusCode is not 202", async () => {
    lambdaMock.on(InvokeCommand).resolves({ StatusCode: 500 });

    await expect(invokeImageProcessorAsync("test-bucket", "members/uuid.jpg")).rejects.toThrow(
      "Image processor trigger failed: StatusCode=500",
    );
  });

  it("no-ops for SVG keys", async () => {
    await invokeImageProcessorAsync("test-bucket", "sponsors/logo.svg");
    expect(lambdaMock.commandCalls(InvokeCommand)).toHaveLength(0);
  });

  it("no-ops when function name is not configured", async () => {
    Reflect.deleteProperty(process.env, "IMAGE_PROCESSOR_FUNCTION_NAME");
    Reflect.deleteProperty(process.env, "CDK_ENVIRONMENT");

    await invokeImageProcessorAsync("test-bucket", "members/uuid.jpg");

    expect(lambdaMock.commandCalls(InvokeCommand)).toHaveLength(0);
  });
});
