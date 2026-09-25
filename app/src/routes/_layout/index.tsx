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
import HomeSectionsSkeleton from "@webapp/components/homepage/HomeSectionsSkeleton";
import HomeSponsors from "@webapp/components/homepage/HomeSponsors";
import HomeTeams from "@webapp/components/homepage/HomeTeams";
import { useHomeLiveTickerData } from "@webapp/hooks/useHomeLiveTicker";
import {
  loadHomePageIntroBackgroundImage,
  loadHomePageSections,
  type HomePageSections,
} from "../../lib/home-page-data";

const DEFAULT_INTRO_BACKGROUND = "/assets/backgrounds/intro1.jpg";

export const Route = createFileRoute("/_layout/")({
  loader: async () => {
    const introBackgroundImage = await loadHomePageIntroBackgroundImage();
    const sections = loadHomePageSections();
    return { introBackgroundImage, sections };
  },
  component: HomePage,
});

function HomePageSections({ sections }: { sections: HomePageSections }) {
  return (
    <>
      <HomeInstagram posts={sections.instagramPosts} />
      <HomeNews initialNews={sections.news} />
      <HomeHeimspiele initialEvents={sections.events} initialHeimspiele={sections.heimspiele} />
      <HomeTeams initialTeams={sections.teams} initialMembers={sections.members} />
      <HomeSponsors initialSponsors={sections.sponsors} />
      <HomeMembers initialMembers={sections.members} />
      <HomeFotos />
      <HomeKontakt initialMembers={sections.members} />
    </>
  );
}

function HomePage() {
  const { introBackgroundImage, sections } = Route.useLoaderData();
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
        backgroundImage={introBackgroundImage || DEFAULT_INTRO_BACKGROUND}
        introContent={introContent}
      />
      <Await promise={sections} fallback={<HomeSectionsSkeleton />}>
        {(data) => <HomePageSections sections={data} />}
      </Await>
    </Stack>
  );
}
