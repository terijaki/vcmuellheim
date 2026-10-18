import { describe, expect, it } from "vite-plus/test";
import { buildAdminCmsOpenApiDocument } from "./admin-cms-openapi";

describe("admin CMS OpenAPI document", () => {
  it("describes news endpoints and uses the request origin as server URL", () => {
    const doc = buildAdminCmsOpenApiDocument("https://dev.new.vcmuellheim.de");

    expect(doc.openapi).toBe("3.1.0");
    expect(doc.servers[0]?.url).toBe("https://dev.new.vcmuellheim.de");
    expect(doc.paths["/api/admin/news"]).toBeDefined();
    const newsById = doc.paths["/api/admin/news/{id}"] as { patch?: unknown };
    expect(newsById.patch).toBeDefined();
    expect(doc.paths["/api/admin/news/{id}/publish"]).toBeDefined();
    expect(doc.paths["/api/admin/media/upload-url"]).toBeDefined();
    expect(doc.paths["/api/admin/media/process"]).toBeDefined();
    expect(doc.info.description).toContain("imageS3Keys");
    const newsArticle = doc.components.schemas.NewsArticle as {
      properties?: Record<string, unknown>;
    };
    expect(newsArticle.properties?.publicUrl).toBeDefined();
    expect(newsArticle.properties?.imageUrls).toBeDefined();
    expect(doc.components.securitySchemes.bearerApiKey).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
  });
});
