import { Stack, Text } from "@mantine/core";
import { Await, createFileRoute } from "@tanstack/react-router";
import HomeContentTabs from "@webapp/components/homepage/HomeContentTabs";
import HomeFotos from "@webapp/components/homepage/HomeFotos";
import HomeHeimspiele from "@webapp/components/homepage/HomeHeimspiele";
import HomeIntro from "@webapp/components/homepage/HomeIntro";
import HomeIntroLogo from "@webapp/components/homepage/HomeIntroLogo";
import HomeKontakt from "@webapp/components/homepage/HomeKontakt";
import HomeMembers from "@webapp/components/homepage/HomeMembers";
import HomeSectionFallback from "@webapp/components/homepage/HomeSectionFallback";
import HomeSponsors from "@webapp/components/homepage/HomeSponsors";
import HomeTeams from "@webapp/components/homepage/HomeTeams";
import { useHomeLiveTickerData } from "@webapp/hooks/useHomeLiveTicker";
import { getUpcomingEventsFn } from "@webapp/server/functions/events";
import { getHomeIntroBackgroundImageFn } from "@webapp/server/functions/home";
import { getHomeMembersFn } from "@webapp/server/functions/members";
import { getHomeNewsFn } from "@webapp/server/functions/news";
import { getHomeHeimspieleFn } from "@webapp/server/functions/sams";
import { getInstagramPostsFn } from "@webapp/server/functions/social";
import { listPublicSponsorsFn } from "@webapp/server/functions/sponsors";
import { listTeamsFn } from "@webapp/server/functions/teams";

/**
 * The default hero is 90vh, which hid every section fallback below the first screen.
 * This height keeps the next section in the initial viewport.
 */
const HOME_HERO_MIN_HEIGHT = "min(42vh, 380px)";

export const Route = createFileRoute("/_layout/")({
  loader: async () => {
    // Await only the intro image. Each section promise is returned unresolved so
    // <Await> can render a fallback and stream the section when that read finishes.
    // https://tanstack.com/router/latest/docs/framework/react/guide/deferred-data-loading
    const introBackgroundImage = await getHomeIntroBackgroundImageFn();
    return {
      introBackgroundImage,
      instagramPosts: getInstagramPostsFn(),
      news: getHomeNewsFn(),
      heimspiele: Promise.all([getUpcomingEventsFn(), getHomeHeimspieleFn()]),
      teams: Promise.all([listTeamsFn(), getHomeMembersFn()]),
      sponsors: listPublicSponsorsFn(),
    };
  },
  component: HomePage,
});

function HomePage() {
  const data = Route.useLoaderData();
  const { hasMatchesToday, isPending } = useHomeLiveTickerData();
  const showLiveLink = !isPending && hasMatchesToday;

  return (
    <Stack gap={0} align="stretch">
      <HomeIntro
        backgroundImage={data.introBackgroundImage}
        introContent={
          <Stack gap={0} align="center" style={{ position: "relative", zIndex: 2 }}>
            <Text fw="bolder" size="xl" mt="xl">
              Willkommen beim
            </Text>
            <HomeIntroLogo />
          </Stack>
        }
        minHeight={HOME_HERO_MIN_HEIGHT}
        showLiveLink={showLiveLink}
      />
      <HomeContentTabs news={data.news} instagramPosts={data.instagramPosts} />
      <Await promise={data.heimspiele} fallback={<HomeSectionFallback title="Heimspiele" />}>
        {([events, heimspiele]) => (
          <HomeHeimspiele initialEvents={events} initialHeimspiele={heimspiele} />
        )}
      </Await>
      <Await promise={data.teams} fallback={<HomeSectionFallback title="Mannschaften" />}>
        {([teams, members]) => <HomeTeams initialTeams={teams} initialMembers={members} />}
      </Await>
      <Await promise={data.sponsors} fallback={<HomeSectionFallback title="Sponsoren" />}>
        {(sponsors) => <HomeSponsors initialSponsors={sponsors} />}
      </Await>
      <Await promise={data.teams} fallback={<HomeSectionFallback title="Verein" />}>
        {([, members]) => (
          <>
            <HomeMembers initialMembers={members} />
            <HomeKontakt initialMembers={members} />
          </>
        )}
      </Await>
      <HomeFotos />
    </Stack>
  );
}
