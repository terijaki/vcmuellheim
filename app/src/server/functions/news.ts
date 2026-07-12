/**
 * News server functions — replaces lib/trpc/routers/news.ts
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { newsSchema } from "@/lib/db/schemas";
import { requireAuthMiddleware } from "../../middleware";
import {
  handleCreateNews,
  handleDeleteNews,
  handleGetGalleryImages,
  handleGetNewsById,
  handleGetPublishedNews,
  handleListAllNews,
  handleUpdateNews,
} from "./news.server";

const cursorSchema = z.string();

const newsInputSchema = newsSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  type: true,
  slug: true,
});

export const getPublishedNewsFn = createServerFn()
  .validator(
    z
      .object({
        limit: z.number().min(1).max(100).optional().default(10),
        cursor: cursorSchema.optional(),
      })
      .optional(),
  )
  .handler(async ({ data }) => handleGetPublishedNews(data));

export const getNewsByIdFn = createServerFn()
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => handleGetNewsById(data.id));

export const getGalleryImagesFn = createServerFn()
  .validator(
    z
      .object({
        limit: z.number().min(1).max(100).optional().default(20),
        format: z.enum(["urls", "keys"]).optional().default("urls"),
        cursor: cursorSchema.optional(),
        shuffle: z.boolean().optional(),
      })
      .optional(),
  )
  .handler(async ({ data }) => handleGetGalleryImages(data));

export const listAllNewsFn = createServerFn()
  .middleware([requireAuthMiddleware])
  .validator(
    z
      .object({
        limit: z.number().min(1).max(100).optional().default(30),
        lastEvaluatedKey: cursorSchema.optional(),
      })
      .optional(),
  )
  .handler(async ({ data }) => handleListAllNews(data));

export const createNewsFn = createServerFn()
  .middleware([requireAuthMiddleware])
  .validator(newsInputSchema)
  .handler(async ({ data }) => handleCreateNews(data));

export const updateNewsFn = createServerFn()
  .middleware([requireAuthMiddleware])
  .validator(
    z.object({
      id: z.uuid(),
      data: newsInputSchema.partial(),
    }),
  )
  .handler(async ({ data: { id, data: updates } }) => handleUpdateNews(id, updates));

export const deleteNewsFn = createServerFn()
  .middleware([requireAuthMiddleware])
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => handleDeleteNews(data.id));
