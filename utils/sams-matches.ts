import { z } from "zod";

export const samsMatchesQuerySchema = z.object({
  league: z.string().optional(),
  season: z.string().optional(),
  sportsclub: z.string().optional(),
  team: z.string().optional(),
  limit: z.number().int().positive().optional(),
  range: z.enum(["past", "future"]).optional(),
  homeOnly: z.boolean().optional(),
});

export type SamsMatchesInput = z.infer<typeof samsMatchesQuerySchema>;

/** Optional wrapper for createServerFn validators. */
export const samsMatchesInputSchema = samsMatchesQuerySchema.optional();
