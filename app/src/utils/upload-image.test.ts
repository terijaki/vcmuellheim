import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const getPresignedUrlFn = vi.fn();
const processMediaImageFn = vi.fn();

vi.mock("@webapp/server/functions/upload", () => ({
  getPresignedUrlFn,
  processMediaImageFn,
}));

const { uploadImageFile } = await import("./upload-image");

describe("uploadImageFile", () => {
  beforeEach(() => {
    getPresignedUrlFn.mockReset();
    processMediaImageFn.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true }) as Response),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uploads to the final key and invokes processing for raster images", async () => {
    getPresignedUrlFn.mockResolvedValue({
      uploadUrl: "https://example.com/put",
      key: "news/uuid.jpg",
    });
    processMediaImageFn.mockResolvedValue(undefined);

    const file = new File(["img"], "article.jpg", { type: "image/jpeg" });
    const key = await uploadImageFile(file, "news");

    expect(key).toBe("news/uuid.jpg");
    expect(getPresignedUrlFn).toHaveBeenCalledWith({
      data: { filename: "article.jpg", contentType: "image/jpeg", folder: "news" },
    });
    expect(processMediaImageFn).toHaveBeenCalledWith({ data: { s3Key: "news/uuid.jpg" } });
  });

  it("skips processing for SVG uploads", async () => {
    getPresignedUrlFn.mockResolvedValue({
      uploadUrl: "https://example.com/put",
      key: "sponsors/uuid.svg",
    });

    const file = new File(["<svg />"], "logo.svg", { type: "image/svg+xml" });
    await uploadImageFile(file, "sponsors");

    expect(processMediaImageFn).not.toHaveBeenCalled();
  });
});
