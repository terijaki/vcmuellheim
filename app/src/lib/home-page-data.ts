import { getUpcomingEventsFn } from "@webapp/server/functions/events";
import { getHomeIntroBackgroundImageFn } from "@webapp/server/functions/home";
import { getHomeMembersFn } from "@webapp/server/functions/members";
import { getHomeNewsFn } from "@webapp/server/functions/news";
import { getHomeHeimspieleFn } from "@webapp/server/functions/sams";
import { getInstagramPostsFn } from "@webapp/server/functions/social";
import { listPublicSponsorsFn } from "@webapp/server/functions/sponsors";
import { listTeamsFn } from "@webapp/server/functions/teams";

export type HomePageSections = {
  instagramPosts: Awaited<ReturnType<typeof getInstagramPostsFn>>;
  events: Awaited<ReturnType<typeof getUpcomingEventsFn>>;
  heimspiele: Awaited<ReturnType<typeof getHomeHeimspieleFn>>;
  news: Awaited<ReturnType<typeof getHomeNewsFn>>;
  sponsors: Awaited<ReturnType<typeof listPublicSponsorsFn>>;
  members: Awaited<ReturnType<typeof getHomeMembersFn>>;
  teams: Awaited<ReturnType<typeof listTeamsFn>>;
};

export async function loadHomePageIntroBackgroundImage(): Promise<string> {
  return getHomeIntroBackgroundImageFn();
}

/** Section reads for the homepage — intended to be returned as a deferred loader promise. */
export async function loadHomePageSections(): Promise<HomePageSections> {
  const [instagramPosts, events, heimspiele, news, sponsors, members, teams] = await Promise.all([
    getInstagramPostsFn(),
    getUpcomingEventsFn(),
    getHomeHeimspieleFn(),
    getHomeNewsFn(),
    listPublicSponsorsFn(),
    getHomeMembersFn(),
    listTeamsFn(),
  ]);
  return {
    instagramPosts,
    events,
    heimspiele,
    news,
    sponsors,
    members,
    teams,
  };
}
