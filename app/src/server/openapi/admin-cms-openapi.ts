/**
 * OpenAPI 3.1 description for the programmatic CMS API (news scope).
 */

export type OpenApiDocument = {
  openapi: "3.1.0";
  info: { title: string; version: string; description: string };
  servers: { url: string; description: string }[];
  paths: Record<string, unknown>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: Record<string, unknown>;
    parameters?: Record<string, unknown>;
    responses?: Record<string, unknown>;
  };
};

export function buildAdminCmsOpenApiDocument(origin: string): OpenApiDocument {
  const serverUrl = origin.replace(/\/+$/, "");
  return {
    openapi: "3.1.0",
    info: {
      title: "VC Müllheim CMS API",
      version: "1.0.0",
      description:
        "Programmatic access to CMS content. Authenticate with a CMS API key (Bearer token) created in the admin UI. Keys are scoped; the news scope covers these endpoints.\n\n" +
        "**News images (gallery):** Article body `content` is HTML only (no inline image upload). Gallery images are stored separately in `imageS3Keys` and shown on the public news page. " +
        "To attach images via API: (1) `POST /api/admin/media/upload-url`, (2) `PUT` the file to `uploadUrl` with the same `Content-Type`, " +
        "(3) `POST /api/admin/media/process` with the returned `key` (skip for SVG), (4) set `imageS3Keys` on create or PATCH. " +
        "Responses include `imageUrls` (CDN URLs, same order as keys) and `publicUrl` for the article page (works for drafts).",
    },
    servers: [{ url: serverUrl, description: "Current deployment" }],
    paths: {
      "/api/admin/openapi.json": {
        get: {
          operationId: "getOpenApiDocument",
          summary: "OpenAPI document",
          description: "Machine-readable API description. Does not require authentication.",
          responses: {
            "200": {
              description: "OpenAPI 3.1 JSON document",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
      "/api/admin/news": {
        get: {
          operationId: "listNews",
          summary: "List news articles",
          security: [{ bearerApiKey: [] }],
          parameters: [
            {
              name: "status",
              in: "query",
              schema: { type: "string", enum: ["draft", "published", "archived"] },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", minimum: 1, maximum: 100 },
            },
            { name: "cursor", in: "query", schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Paginated news list",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/NewsListResponse" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
          },
        },
        post: {
          operationId: "createNewsDraft",
          summary: "Create a news draft",
          description:
            "Creates a news article in draft status. Do not send `status` in the body (request will be rejected); use the publish endpoint to go live.",
          security: [{ bearerApiKey: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateNewsRequest" },
              },
            },
          },
          responses: {
            "201": {
              description: "Draft created",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/NewsArticle" },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
          },
        },
      },
      "/api/admin/news/{id}": {
        get: {
          operationId: "getNewsById",
          summary: "Get one news article",
          security: [{ bearerApiKey: [] }],
          parameters: [{ $ref: "#/components/parameters/NewsId" }],
          responses: {
            "200": {
              description: "News article",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/NewsArticle" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
        delete: {
          operationId: "deleteNews",
          summary: "Delete a news article",
          description:
            "Permanently deletes a news article. Requires the API key owner to be an **Admin** (Moderators cannot delete via API).",
          security: [{ bearerApiKey: [] }],
          parameters: [{ $ref: "#/components/parameters/NewsId" }],
          responses: {
            "200": {
              description: "Article deleted",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["success"],
                    properties: { success: { type: "boolean", const: true } },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
        patch: {
          operationId: "updateNews",
          summary: "Update a news article",
          description:
            "Partial update of title, content, excerpt, images, or tags. Does not change status; use the publish endpoint to go live. Returns `publicUrl` for sharing draft previews with reviewers.",
          security: [{ bearerApiKey: [] }],
          parameters: [{ $ref: "#/components/parameters/NewsId" }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateNewsRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Updated article",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/NewsArticle" },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/api/admin/media/upload-url": {
        post: {
          operationId: "createNewsImageUploadUrl",
          summary: "Presigned URL for a news gallery image",
          description:
            "Returns a short-lived S3 PUT URL and the `news/{uuid}.{ext}` key. Upload the file directly to S3, then call `/api/admin/media/process` for raster images before attaching the key via news create/PATCH.",
          security: [{ bearerApiKey: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MediaUploadUrlRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Upload URL and S3 key",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/MediaUploadUrlResponse" },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
          },
        },
      },
      "/api/admin/media/process": {
        post: {
          operationId: "processNewsImage",
          summary: "Trigger responsive image processing",
          description:
            "Queues the image processor Lambda for a key under `news/`. Omit for SVG uploads. Call after a successful S3 PUT.",
          security: [{ bearerApiKey: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MediaProcessRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Processing accepted",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["ok"],
                    properties: { ok: { type: "boolean", const: true } },
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
          },
        },
      },
      "/api/admin/news/{id}/publish": {
        post: {
          operationId: "publishNews",
          summary: "Publish a news article",
          description:
            "Sets status to published. Idempotent when the article is already published. Publishing may trigger public homepage updates and social sharing.",
          security: [{ bearerApiKey: [] }],
          parameters: [{ $ref: "#/components/parameters/NewsId" }],
          responses: {
            "200": {
              description: "Published article (or unchanged if already published)",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/NewsArticle" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerApiKey: {
          type: "http",
          scheme: "bearer",
          description:
            "CMS API key issued in the admin UI (`/admin/api-keys`). Format: `vcm_<uuid>_<secret>`.",
        },
      },
      parameters: {
        NewsId: {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      },
      responses: {
        Unauthorized: {
          description: "Missing, invalid, or expired API key",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
        Forbidden: {
          description: "API key scope or member role does not allow this action",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
        NotFound: {
          description: "Resource not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
        BadRequest: {
          description: "Invalid request",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
      },
      schemas: {
        ApiError: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                reason: {
                  type: "string",
                  description:
                    "Machine-readable auth failure cause (e.g. missing_token, expired, wrong_scope, admin_required)",
                },
                details: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["path", "message"],
                    properties: {
                      path: { type: "string" },
                      message: { type: "string" },
                    },
                  },
                  description: "Validation errors for 400 responses",
                },
              },
            },
          },
        },
        CreateNewsRequest: {
          type: "object",
          required: ["title", "content"],
          properties: {
            title: { type: "string", minLength: 1, maxLength: 200 },
            content: {
              type: "string",
              minLength: 1,
              description: "HTML content (e.g. from the admin rich-text editor)",
            },
            excerpt: { type: "string", maxLength: 500 },
            imageS3Keys: {
              type: "array",
              items: { type: "string" },
              description: "S3 keys under `news/` from the media upload flow",
            },
            tags: { type: "array", items: { type: "string" } },
          },
        },
        MediaUploadUrlRequest: {
          type: "object",
          required: ["filename", "contentType"],
          properties: {
            filename: { type: "string", minLength: 1 },
            contentType: {
              type: "string",
              enum: ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"],
            },
          },
        },
        MediaUploadUrlResponse: {
          type: "object",
          required: ["uploadUrl", "key", "expiresIn"],
          properties: {
            uploadUrl: { type: "string", format: "uri" },
            key: { type: "string", description: "S3 object key, e.g. news/{uuid}.jpg" },
            expiresIn: { type: "integer", description: "Presigned PUT validity in seconds" },
          },
        },
        MediaProcessRequest: {
          type: "object",
          required: ["s3Key"],
          properties: {
            s3Key: {
              type: "string",
              description: "Key returned from upload-url; must start with news/",
            },
          },
        },
        UpdateNewsRequest: {
          type: "object",
          minProperties: 1,
          properties: {
            title: { type: "string", minLength: 1, maxLength: 200 },
            content: {
              type: "string",
              minLength: 1,
              description: "HTML content (e.g. from the admin rich-text editor)",
            },
            excerpt: { type: "string", maxLength: 500 },
            imageS3Keys: {
              type: "array",
              items: { type: "string" },
              description: "S3 keys under `news/` from the media upload flow",
            },
            tags: { type: "array", items: { type: "string" } },
          },
        },
        NewsArticle: {
          type: "object",
          required: [
            "id",
            "type",
            "title",
            "slug",
            "content",
            "status",
            "publicUrl",
            "imageUrls",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            type: { type: "string", const: "article" },
            title: { type: "string" },
            slug: { type: "string" },
            content: { type: "string" },
            excerpt: { type: "string" },
            status: { type: "string", enum: ["draft", "published", "archived"] },
            publicUrl: {
              type: "string",
              format: "uri",
              description:
                "Canonical public page URL (`/news/{id}`). Works for drafts so reviewers can open the article before publish.",
            },
            imageS3Keys: { type: "array", items: { type: "string" } },
            imageUrls: {
              type: "array",
              items: { type: "string", format: "uri" },
              description: "Public CDN URLs for gallery images, same order as imageS3Keys",
            },
            tags: { type: "array", items: { type: "string" } },
            sharedToMastodon: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        NewsListResponse: {
          type: "object",
          required: ["items"],
          properties: {
            items: {
              type: "array",
              items: { $ref: "#/components/schemas/NewsArticle" },
            },
            nextCursor: { type: "string" },
          },
        },
      },
    },
  };
}
