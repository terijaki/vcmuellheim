import { beforeEach, describe, expect, it, vi } from "vitest";

const captureException = vi.hoisted(() => vi.fn());

vi.mock("../utils/sentry", () => ({
  Sentry: {
    captureException,
    init: vi.fn(),
    getClient: vi.fn(),
    wrapHandler: vi.fn((fn: unknown) => fn),
  },
  wrapLambdaHandler: (handler: unknown) => handler,
}));

const s3Send = vi.hoisted(() => vi.fn());

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = s3Send;
  },
  GetObjectCommand: class {
    constructor(public readonly input: unknown) {}
  },
  PutObjectCommand: class {
    constructor(public readonly input: unknown) {}
  },
}));

vi.mock("./image-utils", () => ({
  compressOriginal: vi.fn(),
  generateJpegVariant: vi.fn(),
  generateWebpVariant: vi.fn(),
  getContentTypeForExtension: vi.fn(() => "image/jpeg"),
  getImageExtension: vi.fn(() => "jpg"),
}));

vi.mock("@/lib/media/image-processing", () => ({
  shouldProcessImageKey: () => true,
}));

describe("image-processor Sentry", () => {
  beforeEach(() => {
    captureException.mockClear();
    s3Send.mockReset();
  });

  it("captures a swallowed processing failure exactly once", async () => {
    s3Send.mockRejectedValue(new Error("S3 unavailable"));

    const { handler } = await import("./image-processor");

    const result = await handler({ bucket: "media-bucket", key: "members/photo.jpg" });

    expect(result.success).toBe(false);
    expect(captureException).toHaveBeenCalledOnce();
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "S3 unavailable" }),
      expect.objectContaining({ extra: { bucket: "media-bucket", key: "members/photo.jpg" } }),
    );
  });
});
