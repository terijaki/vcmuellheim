import { Anchor, Card, Group, Loader, SimpleGrid, Stack, Switch, Text, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import CardTitle from "@webapp/components/CardTitle";
import EventCard from "@webapp/components/EventCard";
import PageWithHeading from "@webapp/components/layout/PageWithHeading";
import Matches from "@webapp/components/Matches";
import { useSamsMatches } from "@webapp/hooks/dataQueries";
import { getUpcomingEventsFn } from "@webapp/server/functions/events";
import { getCurrentTermineFn } from "@webapp/server/functions/sams";
import { buildSamsMatchesHookOptions } from "@webapp/utils/sams-ssr";
import { createWebcalLink } from "@webapp/utils/webcal";
import dayjs from "dayjs";
import { Fragment, useState } from "react";
import { FaBullhorn as IconSubscribe } from "react-icons/fa6";
import type { SamsMatchesHookOptions } from "@webapp/utils/sams-ssr";

export const Route = createFileRoute("/_layout/termine/")({
  loader: async () => {
    const [eventsResult, termineResult] = await Promise.allSettled([
      getUpcomingEventsFn(),
      getCurrentTermineFn({ data: { range: "future" } }),
    ]);

    const events = eventsResult.status === "fulfilled" ? eventsResult.value.items : [];
    const termine = termineResult.status === "fulfilled" ? termineResult.value : null;
    const cached =
      termine && termine.matches.length > 0
        ? { matches: termine.matches, timestamp: termine.timestamp }
        : null;
    const matchesQueryOptions = buildSamsMatchesHookOptions({ range: "future" }, cached);
    const ownedTeamUuids = termine?.ownedTeamUuids ?? [];
    const leagueNameByUuid: Record<string, string> = {};
    for (const match of termine?.matchesWithMeta ?? []) {
      if (match.leagueUuid && match.leagueName) {
        leagueNameByUuid[match.leagueUuid] = match.leagueName;
      }
    }

    return { events, matchesQueryOptions, ownedTeamUuids, leagueNameByUuid };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { events, matchesQueryOptions, ownedTeamUuids, leagueNameByUuid } = Route.useLoaderData();
  const [homeGamesOnly, setHomeGamesOnly] = useState(false);
  const webcalLink = createWebcalLink(homeGamesOnly ? "/ics/home.ics" : "/ics/all.ics");
  const subscribeLabel = homeGamesOnly
    ? "Abboniere unsere Heimspiele"
    : "Abboniere unseren Vereinskalender";

  return (
    <PageWithHeading
      title="Termine"
      description="Alle Termine, Spieltage und Events von Volleyballclub Müllheim im Überblick"
    >
      <Stack>
        <Card>
          <Stack>
            <Group justify="space-between" align="center" wrap="wrap">
              <CardTitle>Kalender Integration</CardTitle>
              <Switch
                label="Nur Heimspiele"
                checked={homeGamesOnly}
                onChange={(event) => setHomeGamesOnly(event.currentTarget.checked)}
              />
            </Group>
            <Text>
              <Anchor href={webcalLink} style={{ display: "inline-flex", gap: 4 }}>
                <IconSubscribe /> {subscribeLabel}
              </Anchor>
              , um neue Termine saisonübergreifend automatisch in deiner{" "}
              <Text fw="bold" span>
                Kalender-App
              </Text>{" "}
              zu empfangen.
            </Text>
          </Stack>
        </Card>
        <EventsContent events={events} />
        <MatchesContent
          matchesQueryOptions={matchesQueryOptions}
          homeGamesOnly={homeGamesOnly}
          onHomeGamesOnlyChange={setHomeGamesOnly}
          ownedTeamUuids={ownedTeamUuids}
          leagueNameByUuid={leagueNameByUuid}
        />
      </Stack>
    </PageWithHeading>
  );
}

function EventsContent({
  events,
}: {
  events: Awaited<ReturnType<typeof getUpcomingEventsFn>>["items"];
}) {
  if (!events || events.length === 0) {
    return null;
  }

  return (
    <Card>
      <Title order={2} c="blumine">
        Veranstaltungen
      </Title>
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {events.map((event) => {
          return <EventCard {...event} key={event.id} />;
        })}
      </SimpleGrid>
    </Card>
  );
}

function MatchesContent({
  matchesQueryOptions,
  homeGamesOnly,
  onHomeGamesOnlyChange,
  ownedTeamUuids,
  leagueNameByUuid,
}: {
  matchesQueryOptions: SamsMatchesHookOptions | undefined;
  homeGamesOnly: boolean;
  onHomeGamesOnlyChange: (value: boolean) => void;
  ownedTeamUuids: string[];
  leagueNameByUuid: Record<string, string>;
}) {
  const {
    data: matchesData,
    isLoading,
    isError,
  } = useSamsMatches({
    ...(matchesQueryOptions ?? { range: "future" }),
    homeOnly: homeGamesOnly || undefined,
    // Loader seed is for the unfiltered future list; don't reuse it for home-only.
    ...(homeGamesOnly ? { initialData: undefined, initialDataUpdatedAt: undefined } : {}),
  });

  const currentMonth = dayjs().month() + 1;
  const isOffSeason = currentMonth >= 5 && currentMonth <= 9;
  const matches = matchesData?.matches ?? [];

  if (isLoading && !matchesData) {
    return (
      <Card>
        <CardTitle>Ligaspiele</CardTitle>
        <Stack align="center" py="md" gap="xs">
          <Loader size="sm" />
          <Text c="dimmed" size="sm">
            Lade Spieltermine...
          </Text>
        </Stack>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardTitle>Fehler beim Laden der SBVV Ligaspiele</CardTitle>
        <Text>Die Spieltermine konnten nicht geladen werden. Bitte versuche es später erneut.</Text>
      </Card>
    );
  }

  if (matches.length > 0 || homeGamesOnly) {
    const timestampDate = matchesData?.timestamp ? new Date(matchesData.timestamp) : undefined;
    return (
      <Card>
        <Group justify="space-between" align="center" mb="sm" wrap="wrap">
          <Title order={2} c="blumine">
            Ligaspiele
          </Title>
          <Switch
            label="Nur Heimspiele"
            checked={homeGamesOnly}
            onChange={(event) => onHomeGamesOnlyChange(event.currentTarget.checked)}
          />
        </Group>
        {matches.length > 0 ? (
          <Matches
            matches={matches}
            timestamp={timestampDate}
            type="future"
            ownedTeamUuids={ownedTeamUuids}
            leagueNameByUuid={leagueNameByUuid}
          />
        ) : (
          <Text>Derzeit stehen keine Heimspiele an.</Text>
        )}
      </Card>
    );
  }

  return (
    <Fragment>
      <Card>
        <CardTitle>Keine anstehenden Ligaspiele</CardTitle>
        <Text>
          {isOffSeason
            ? "Außerhalb der Saison stehen derzeit keine Ligaspiele an."
            : "Derzeit stehen keine Ligaspiele an."}
        </Text>
      </Card>
    </Fragment>
  );
}
