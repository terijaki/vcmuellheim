import { Stack, Text, Title } from "@mantine/core";
import { Await, createFileRoute } from "@tanstack/react-router";
import HomeFotos from "@webapp/components/homepage/HomeFotos";
import HomeHeimspiele from "@webapp/components/homepage/HomeHeimspiele";
import HomeInstagram from "@webapp/components/homepage/HomeInstagram";
import HomeIntro from "@webapp/components/homepage/HomeIntro";
import HomeIntroLogo from "@webapp/components/homepage/HomeIntroLogo";
import HomeKontakt from "@webapp/components/homepage/HomeKontakt";
import HomeLiveTicker from "@webapp/components/homepage/HomeLiveTicker";
import HomeMembers from "@webapp/components/homepage/HomeMembers";
import HomeNews from "@webapp/components/homepage/HomeNews";
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
  const { ourMatches, hasMatchesToday, hasOpenMatches, isPending } = useHomeLiveTickerData();
  const showLiveTicker = !isPending && hasMatchesToday;

  const introContent = showLiveTicker ? (
    <Stack gap="md" align="center" style={{ position: "relative", zIndex: 2 }}>
      <Stack gap={0} align="center">
        <Title order={2} c="white" mt="xl" style={{ textWrap: "balance" }} ta="center">
          Willkommen beim Volleyballclub Müllheim
        </Title>
        <Text c="white">
          {hasOpenMatches
            ? "Unsere Mannschaften spielen gerade!"
            : "Unsere Mannschaften haben heute gespielt!"}
        </Text>
      </Stack>
      <HomeLiveTicker matches={ourMatches} />
    </Stack>
  ) : (
    <Stack gap={0} align="center" style={{ position: "relative", zIndex: 2 }}>
      <Text fw="bolder" size="xl" mt="xl">
        Willkommen beim
      </Text>
      <HomeIntroLogo />
    </Stack>
  );

  return (
    <Stack gap={0} align="stretch">
      <HomeIntro
        backgroundImage={data.introBackgroundImage}
        introContent={introContent}
        minHeight={HOME_HERO_MIN_HEIGHT}
      />
      <Await promise={data.instagramPosts} fallback={<HomeSectionFallback title="Instagram" />}>
        {(posts) => <HomeInstagram posts={posts} />}
      </Await>
      <Await promise={data.news} fallback={<HomeSectionFallback title="News" />}>
        {(news) => <HomeNews initialNews={news} />}
      </Await>
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
