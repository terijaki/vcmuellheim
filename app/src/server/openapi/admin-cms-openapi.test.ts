import { describe, expect, it } from "vite-plus/test";
import { buildAdminCmsOpenApiDocument } from "./admin-cms-openapi";

describe("admin CMS OpenAPI document", () => {
  it("describes news endpoints and uses the request origin as server URL", () => {
    const doc = buildAdminCmsOpenApiDocument("https://dev.new.vcmuellheim.de");

    expect(doc.openapi).toBe("3.1.0");
    expect(doc.servers[0]?.url).toBe("https://dev.new.vcmuellheim.de");
    expect(doc.paths["/api/admin/news"]).toBeDefined();
    expect(doc.paths["/api/admin/news/{id}/publish"]).toBeDefined();
    expect(doc.components.securitySchemes.bearerApiKey).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
  });
});
