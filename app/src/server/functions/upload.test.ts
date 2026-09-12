import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { handleGetPresignedUrl, handleProcessMediaImage } from "./upload.server";

const lambdaMock = mockClient(LambdaClient);

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async () => "https://example.com/presigned"),
}));

describe("handleGetPresignedUrl", () => {
  beforeEach(() => {
    process.env.MEDIA_BUCKET_NAME = "test-media-bucket";
    process.env.AWS_REGION = "eu-central-1";
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, "MEDIA_BUCKET_NAME");
    Reflect.deleteProperty(process.env, "AWS_REGION");
  });

  it("presigns the final key for raster images", async () => {
    const result = await handleGetPresignedUrl({
      filename: "avatar.jpg",
      contentType: "image/jpeg",
      folder: "members",
    });

    expect(result.key).toMatch(/^members\/[0-9a-f-]+\.jpg$/);
    expect(result.key).not.toContain("uploads/");
    expect(result.bucket).toBe("test-media-bucket");
  });

  it("presigns the final key for news images", async () => {
    const result = await handleGetPresignedUrl({
      filename: "article.jpg",
      contentType: "image/jpeg",
      folder: "news",
    });

    expect(result.key).toMatch(/^news\/[0-9a-f-]+\.jpg$/);
    expect(result.key).not.toContain("uploads/");
  });

  it("presigns the final key for SVG uploads", async () => {
    const result = await handleGetPresignedUrl({
      filename: "logo.svg",
      contentType: "image/svg+xml",
      folder: "sponsors",
    });

    expect(result.key).toMatch(/^sponsors\/[0-9a-f-]+\.svg$/);
  });
});

describe("handleProcessMediaImage", () => {
  beforeEach(() => {
    lambdaMock.reset();
    process.env.MEDIA_BUCKET_NAME = "test-media-bucket";
    process.env.IMAGE_PROCESSOR_FUNCTION_NAME = "vcm-bun-image-processor-dev";
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, "MEDIA_BUCKET_NAME");
    Reflect.deleteProperty(process.env, "IMAGE_PROCESSOR_FUNCTION_NAME");
  });

  it("invokes the image processor for allowed keys", async () => {
    lambdaMock.on(InvokeCommand).resolves({ StatusCode: 202 });

    await handleProcessMediaImage("members/uuid.jpg");

    const calls = lambdaMock.commandCalls(InvokeCommand);
    expect(calls).toHaveLength(1);
    expect(JSON.parse(String(calls[0]?.args[0].input.Payload))).toEqual({
      bucket: "test-media-bucket",
      key: "members/uuid.jpg",
    });
  });

  it("throws when MEDIA_BUCKET_NAME is missing", async () => {
    Reflect.deleteProperty(process.env, "MEDIA_BUCKET_NAME");

    await expect(handleProcessMediaImage("members/uuid.jpg")).rejects.toThrow(
      "MEDIA_BUCKET_NAME is not configured",
    );
  });
});
