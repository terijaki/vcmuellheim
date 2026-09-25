import { Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
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
import { resolveHomePageLoader, type HomePageSnapshot } from "../../lib/home-page-loader";

const DEFAULT_INTRO_BACKGROUND = "/assets/backgrounds/intro1.jpg";

type HomePageData = {
  introBackgroundImage: string;
  instagramPosts: Awaited<ReturnType<typeof getInstagramPostsFn>>;
  events: Awaited<ReturnType<typeof getUpcomingEventsFn>>;
  heimspiele: Awaited<ReturnType<typeof getHomeHeimspieleFn>>;
  news: Awaited<ReturnType<typeof getHomeNewsFn>>;
  sponsors: Awaited<ReturnType<typeof listPublicSponsorsFn>>;
  members: Awaited<ReturnType<typeof getHomeMembersFn>>;
  teams: Awaited<ReturnType<typeof listTeamsFn>>;
};

let homePageCache: HomePageSnapshot<HomePageData> | null = null;

async function loadHomePageData(): Promise<HomePageData> {
  const [introBackgroundImage, instagramPosts, events, heimspiele, news, sponsors, members, teams] =
    await Promise.all([
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
}

export const Route = createFileRoute("/_layout/")({
  loader: () =>
    resolveHomePageLoader({
      load: loadHomePageData,
      cache: homePageCache,
      now: Date.now(),
      wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      store: (snapshot) => {
        homePageCache = snapshot;
      },
    }),
  component: HomePage,
});

function HomePage() {
  const loaderData = Route.useLoaderData();
  const ready = loaderData.ready ? loaderData.data : null;
  const instagramQuery = useQuery({
    queryKey: ["home", "instagram"],
    queryFn: () => getInstagramPostsFn(),
    initialData: ready?.instagramPosts,
    initialDataUpdatedAt: ready ? Date.now() : undefined,
    staleTime: 1000 * 60 * 5,
  });
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
        backgroundImage={ready?.introBackgroundImage ?? DEFAULT_INTRO_BACKGROUND}
        introContent={introContent}
      />
      <HomeInstagram posts={instagramQuery.data ?? []} />
      <HomeNews initialNews={ready?.news} />
      <HomeHeimspiele initialEvents={ready?.events} initialHeimspiele={ready?.heimspiele} />
      <HomeTeams initialTeams={ready?.teams} initialMembers={ready?.members} />
      <HomeSponsors initialSponsors={ready?.sponsors} />
      <HomeMembers initialMembers={ready?.members} />
      <HomeFotos />
      <HomeKontakt initialMembers={ready?.members} />
    </Stack>
  );
}
