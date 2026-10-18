import { describe, expect, it } from "vite-plus/test";
import { buildNewsPublicUrl, withNewsPublicUrl } from "./news-public-url";

describe("news public URL", () => {
  it("builds /news/{id} under the given origin", () => {
    expect(
      buildNewsPublicUrl("https://vcmuellheim.de", "11111111-1111-4111-8111-111111111111"),
    ).toBe("https://vcmuellheim.de/news/11111111-1111-4111-8111-111111111111");
    expect(buildNewsPublicUrl("https://vcmuellheim.de/", "abc")).toBe(
      "https://vcmuellheim.de/news/abc",
    );
  });

  it("adds publicUrl to article payloads", () => {
    const article = {
      id: "22222222-2222-4222-8222-222222222222",
      type: "article" as const,
      title: "T",
      slug: "t",
      content: "<p>x</p>",
      status: "draft" as const,
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2020-01-01T00:00:00.000Z",
    };
    expect(withNewsPublicUrl("https://example.com", article).publicUrl).toBe(
      "https://example.com/news/22222222-2222-4222-8222-222222222222",
    );
  });
});
