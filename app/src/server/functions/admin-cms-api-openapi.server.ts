/**
 * OpenAPI document for the programmatic CMS API.
 */

import { buildAdminCmsOpenApiDocument } from "../openapi/admin-cms-openapi";
import { resolveNewsPublicOrigin } from "../news-public-url";
import { PUBLIC_JSON_HEADERS } from "./admin-cms-api-http.server";

export function getAdminCmsOpenApiResponse(request: Request): Response {
  const origin = resolveNewsPublicOrigin(request);
  const document = buildAdminCmsOpenApiDocument(origin);
  return new Response(JSON.stringify(document), { status: 200, headers: PUBLIC_JSON_HEADERS });
}
