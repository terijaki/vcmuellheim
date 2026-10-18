import { describe, expect, it } from "vite-plus/test";
import { isCmsNewsImageContentType, validateNewsGalleryS3Keys } from "./admin-news-images";

describe("validateNewsGalleryS3Keys", () => {
  it("accepts keys under news/", () => {
    expect(validateNewsGalleryS3Keys(["news/abc.jpg"])).toBeNull();
  });

  it("rejects keys outside news/", () => {
    expect(validateNewsGalleryS3Keys(["members/abc.jpg"])).toMatch(/news\//);
  });

  it("rejects disallowed prefixes", () => {
    expect(validateNewsGalleryS3Keys(["uploads/news/x.jpg"])).toBeTruthy();
  });
});

describe("isCmsNewsImageContentType", () => {
  it("accepts common image types", () => {
    expect(isCmsNewsImageContentType("image/jpeg")).toBe(true);
    expect(isCmsNewsImageContentType("image/svg+xml")).toBe(true);
  });

  it("rejects non-image types", () => {
    expect(isCmsNewsImageContentType("application/pdf")).toBe(false);
  });
});
