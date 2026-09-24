import { Stack, Text, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import HomeFotos from "@webapp/components/homepage/HomeFotos";
import HomeHeimspiele from "@webapp/components/homepage/HomeHeimspiele";
import HomeInstagram from "@webapp/components/homepage/HomeInstagram";
import HomeIntro from "@webapp/components/homepage/HomeIntro";
import HomeIntroLogo from "@webapp/components/homepage/HomeIntroLogo";
import HomeKontakt from "@webapp/components/homepage/HomeKontakt";
import HomeLiveTicker from "@webapp/components/homepage/HomeLiveTicker";
import HomeMembers from "@webapp/components/homepage/HomeMembers";
import HomeNews from "@webapp/components/homepage/HomeNews";
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

export const Route = createFileRoute("/_layout/")({
  loader: async () => {
    const [
      introBackgroundImage,
      instagramPosts,
      events,
      heimspiele,
      news,
      sponsors,
      members,
      teams,
    ] = await Promise.all([
      getHomeIntroBackgroundImageFn(),
      getInstagramPostsFn(),
      getUpcomingEventsFn(),
      getHomeHeimspieleFn(),
      getHomeNewsFn(),
      listPublicSponsorsFn(),
      getHomeMembersFn(),
      listTeamsFn(),
    ]);
    return {
      introBackgroundImage,
      instagramPosts,
      events,
      heimspiele,
      news,
      sponsors,
      members,
      teams,
    };
  },
  component: HomePage,
});

function HomePage() {
  const {
    introBackgroundImage,
    instagramPosts,
    events,
    heimspiele,
    news,
    sponsors,
    members,
    teams,
  } = Route.useLoaderData();
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
      <HomeIntro backgroundImage={introBackgroundImage} introContent={introContent} />
      <HomeInstagram posts={instagramPosts} />
      <HomeNews initialNews={news} />
      <HomeHeimspiele initialEvents={events} initialHeimspiele={heimspiele} />
      <HomeTeams initialTeams={teams} initialMembers={members} />
      <HomeSponsors initialSponsors={sponsors} />
      <HomeMembers initialMembers={members} />
      <HomeFotos />
      <HomeKontakt initialMembers={members} />
    </Stack>
  );
}
