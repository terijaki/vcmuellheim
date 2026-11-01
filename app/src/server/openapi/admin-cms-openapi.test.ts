import { describe, expect, it } from "vite-plus/test";
import { buildAdminCmsOpenApiDocument } from "./admin-cms-openapi";

describe("admin CMS OpenAPI document", () => {
  it("describes CMS endpoints and uses the request origin as server URL", () => {
    const doc = buildAdminCmsOpenApiDocument("https://dev.new.vcmuellheim.de");

    expect(doc.openapi).toBe("3.1.0");
    expect(doc.servers[0]?.url).toBe("https://dev.new.vcmuellheim.de");
    expect(doc.paths["/api/admin/news"]).toBeDefined();
    const newsById = doc.paths["/api/admin/news/{id}"] as { patch?: unknown; delete?: unknown };
    expect(newsById.patch).toBeDefined();
    expect(newsById.delete).toBeDefined();
    expect(doc.paths["/api/admin/news/{id}/publish"]).toBeDefined();
    expect(doc.paths["/api/admin/media/upload-url"]).toBeDefined();
    expect(doc.paths["/api/admin/media/process"]).toBeDefined();
    expect(doc.paths["/api/admin/events"]).toBeDefined();
    expect(doc.paths["/api/admin/events/{id}"]).toBeDefined();
    expect(doc.paths["/api/admin/volunteer-events"]).toBeDefined();
    expect(doc.paths["/api/admin/volunteer-events/{id}"]).toBeDefined();
    const bus = doc.paths["/api/admin/bus"] as { get?: unknown; post?: unknown };
    expect(bus.get).toBeDefined();
    expect(bus.post).toBeDefined();
    const busById = doc.paths["/api/admin/bus/{id}"] as {
      get?: unknown;
      patch?: unknown;
      delete?: unknown;
    };
    expect(busById.get).toBeDefined();
    expect(busById.patch).toBeDefined();
    expect(busById.delete).toBeDefined();
    expect(doc.info.description).toContain("imageS3Keys");
    expect(doc.info.description).toContain("volunteerEvents");
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
