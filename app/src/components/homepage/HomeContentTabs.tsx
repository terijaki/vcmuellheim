import { Center, Container, Skeleton, Stack, Tabs } from "@mantine/core";
import { Await } from "@tanstack/react-router";
import type { BeholdPost } from "@/lambda/social/types";
import { useHomeLiveTickerData } from "@webapp/hooks/useHomeLiveTicker";
import type { getHomeNewsFn } from "@webapp/server/functions/news";
import { useEffect, useState } from "react";
import HomeInstagram from "./HomeInstagram";
import HomeLiveTicker from "./HomeLiveTicker";
import HomeNews from "./HomeNews";
import ScrollAnchor from "./ScrollAnchor";

type HomeContentTab = "news" | "instagram" | "live";
type HomeNewsData = Awaited<ReturnType<typeof getHomeNewsFn>>;

type HomeContentTabsProps = {
  news: Promise<HomeNewsData>;
  instagramPosts: Promise<BeholdPost[]>;
};

const tabStyles = {
  list: {
    justifyContent: "center",
    borderBottom: "none",
    gap: "var(--mantine-spacing-md)",
    "&::before": {
      display: "none",
    },
  },
  tab: {
    color: "var(--mantine-color-blumine-filled)",
    fontSize: "var(--mantine-h3-font-size)",
    fontWeight: 700,
    paddingInline: "var(--mantine-spacing-xs)",
    borderBottomWidth: 2,
    borderColor: "transparent",
    "&:hover": {
      backgroundColor: "transparent",
      borderColor: "transparent",
    },
    "&[data-active]": {
      borderColor: "color-mix(in srgb, var(--mantine-color-blumine-filled) 30%, transparent)",
      color: "var(--mantine-color-blumine-filled)",
    },
  },
} as const;

function TabsFallback() {
  return (
    <Container size="xl" w="100%" py="md" px={{ base: "lg", md: "xl" }}>
      <Stack>
        <Center pb="xs">
          <Tabs value="news" variant="default" color="blumine" styles={tabStyles}>
            <Tabs.List>
              <Tabs.Tab value="news">News</Tabs.Tab>
            </Tabs.List>
          </Tabs>
        </Center>
        <Skeleton height={140} maw={620} />
        <Skeleton height={140} maw={620} />
      </Stack>
    </Container>
  );
}

export default function HomeContentTabs({ news, instagramPosts }: HomeContentTabsProps) {
  return (
    <Await promise={news} fallback={<TabsFallback />}>
      {(initialNews) => (
        <Await promise={instagramPosts} fallback={<TabsShell initialNews={initialNews} />}>
          {(posts) => <TabsShell initialNews={initialNews} posts={posts} />}
        </Await>
      )}
    </Await>
  );
}

function TabsShell({ initialNews, posts }: { initialNews: HomeNewsData; posts?: BeholdPost[] }) {
  const { ourMatches, hasMatchesToday, isPending } = useHomeLiveTickerData();
  const showInstagram = (posts?.length ?? 0) > 0;
  const showLive = !isPending && hasMatchesToday;

  const [activeTab, setActiveTab] = useState<HomeContentTab>("news");

  useEffect(() => {
    if ((activeTab === "instagram" && !showInstagram) || (activeTab === "live" && !showLive)) {
      setActiveTab("news");
    }
  }, [activeTab, showInstagram, showLive]);

  return (
    <Container size="xl" w="100%" py="md" px={{ base: "lg", md: "xl" }} pos="relative">
      <ScrollAnchor name="news" />
      {showInstagram && <ScrollAnchor name="instagram" />}
      {showLive && <ScrollAnchor name="live" />}
      <Tabs
        value={activeTab}
        onChange={(value) => {
          if (value === "news" || value === "instagram" || value === "live") {
            setActiveTab(value);
          }
        }}
        variant="default"
        color="blumine"
        styles={tabStyles}
        keepMounted={false}
      >
        <Center pb="xs">
          <Tabs.List>
            <Tabs.Tab value="news">News</Tabs.Tab>
            {showInstagram && <Tabs.Tab value="instagram">Instagram</Tabs.Tab>}
            {showLive && <Tabs.Tab value="live">Live</Tabs.Tab>}
          </Tabs.List>
        </Center>

        <Tabs.Panel value="news" pt="md">
          <HomeNews initialNews={initialNews} hideHeading />
        </Tabs.Panel>

        {showInstagram && posts && (
          <Tabs.Panel value="instagram" pt="md">
            <HomeInstagram posts={posts} hideHeading />
          </Tabs.Panel>
        )}

        {showLive && (
          <Tabs.Panel value="live" pt="md">
            <HomeLiveTicker matches={ourMatches} embedded />
          </Tabs.Panel>
        )}
      </Tabs>
    </Container>
  );
}
