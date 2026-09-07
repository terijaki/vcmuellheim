import { Anchor, Card, Group, Loader, SimpleGrid, Stack, Switch, Text, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import CardTitle from "@webapp/components/CardTitle";
import EventCard from "@webapp/components/EventCard";
import PageWithHeading from "@webapp/components/layout/PageWithHeading";
import Matches from "@webapp/components/Matches";
import { useSamsMatches, useSamsTeams } from "@webapp/hooks/dataQueries";
import { getUpcomingEventsFn } from "@webapp/server/functions/events";
import { loadSamsMatchesForSsrFn } from "@webapp/server/functions/sams";
import { createWebcalLink } from "@webapp/utils/webcal";
import { filterHomeMatches } from "@/utils/sams-match-filter";
import { getOwnedSamsTeamUuids } from "@/utils/sams";
import dayjs from "dayjs";
import { Fragment, useState } from "react";
import { FaBullhorn as IconSubscribe } from "react-icons/fa6";
import type { SamsMatchesHookOptions } from "@webapp/utils/sams-ssr";

export const Route = createFileRoute("/_layout/termine/")({
  loader: async () => {
    const [eventsResult, matchesSsr] = await Promise.allSettled([
      getUpcomingEventsFn(),
      loadSamsMatchesForSsrFn({ data: { range: "future" } }),
    ]);

    const events = eventsResult.status === "fulfilled" ? eventsResult.value.items : [];
    const matchesQueryOptions =
      matchesSsr.status === "fulfilled"
        ? matchesSsr.value.hookOptions
        : ({ range: "future" } satisfies SamsMatchesHookOptions);

    return { events, matchesQueryOptions };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { events, matchesQueryOptions } = Route.useLoaderData();
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
}: {
  matchesQueryOptions: SamsMatchesHookOptions | undefined;
  homeGamesOnly: boolean;
  onHomeGamesOnlyChange: (value: boolean) => void;
}) {
  const { data: samsTeamsData, isPending: isSamsTeamsPending } = useSamsTeams();
  const {
    data: matchesData,
    isLoading,
    isError,
  } = useSamsMatches(matchesQueryOptions ?? { range: "future" });

  const currentMonth = dayjs().month() + 1;
  const isOffSeason = currentMonth >= 5 && currentMonth <= 9;
  const ownedTeamUuids = getOwnedSamsTeamUuids(samsTeamsData?.teams ?? []);
  const matches = matchesData?.matches ?? [];
  const homeFilterPending = homeGamesOnly && isSamsTeamsPending;
  const visibleMatches =
    homeGamesOnly && !isSamsTeamsPending ? filterHomeMatches(matches, ownedTeamUuids) : matches;

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

  if (matches.length > 0) {
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
        {homeFilterPending ? (
          <Stack align="center" py="md" gap="xs">
            <Loader size="sm" />
            <Text c="dimmed" size="sm">
              Lade Heimspiele...
            </Text>
          </Stack>
        ) : visibleMatches.length > 0 ? (
          <Matches matches={visibleMatches} timestamp={timestampDate} type="future" />
        ) : (
          <Text>Derzeit stehen keine Heimspiele an.</Text>
        )}
      </Card>
    );
  }

  return (
    <Fragment>
      <Card>
        <CardTitle>Keine Ligaspiele</CardTitle>
        <Text>Derzeit stehen keine weiteren Spieltermine an.</Text>
      </Card>
      {isOffSeason && (
        <Card>
          <CardTitle>Außerhalb der Saison?</CardTitle>
          <Text>
            Die Saison im Hallenvolleyball findet in der Regel in den Monaten von September bis
            April statt. Dazwischen wird die nächste Saison vorbereitet und die neusten
            Informationen vom Südbadischen Volleyballverband wurden ggf. noch nicht veröffentlicht.
          </Text>
        </Card>
      )}
    </Fragment>
  );
}
