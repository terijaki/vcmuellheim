/**
 * Social media server functions — reads cached Behold Instagram posts from DynamoDB.
 *
 * Posts are proactively synced by the scheduled `behold-sync` Lambda, which runs
 * hourly from 07:00-21:00 UTC (15 times per day). This route never calls the
 * Behold API directly, eliminating any risk of hitting the 1200 views/month
 * free-tier limit on the main request path.
 */

import { createServerFn } from "@tanstack/react-start";
import { handleGetInstagramPosts } from "./social.server";

export const getInstagramPostsFn = createServerFn({ method: "GET" }).handler(async () =>
  handleGetInstagramPosts(),
);
