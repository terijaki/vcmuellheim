import { Anchor, Card, Loader, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import CardTitle from "@webapp/components/CardTitle";
import EventCard from "@webapp/components/EventCard";
import PageWithHeading from "@webapp/components/layout/PageWithHeading";
import Matches from "@webapp/components/Matches";
import { useSamsMatches } from "@webapp/hooks/dataQueries";
import { getUpcomingEventsFn } from "@webapp/server/functions/events";
import { loadSamsMatchesForSsrFn } from "@webapp/server/functions/sams";
import { createWebcalLink } from "@webapp/utils/webcal";
import dayjs from "dayjs";
import { Fragment } from "react";
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
  const webcalLink = createWebcalLink("/ics/all.ics");

  return (
    <PageWithHeading
      title="Termine"
      description="Alle Termine, Spieltage und Events von Volleyballclub Müllheim im Überblick"
    >
      <Stack>
        <Card>
          <Stack>
            <CardTitle>Kalender Integration</CardTitle>
            <Text>
              <Anchor href={webcalLink} style={{ display: "inline-flex", gap: 4 }}>
                <IconSubscribe /> Abboniere unseren Vereinskalender
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
        <MatchesContent matchesQueryOptions={matchesQueryOptions} />
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
}: {
  matchesQueryOptions: SamsMatchesHookOptions | undefined;
}) {
  const {
    data: matchesData,
    isLoading,
    isError,
  } = useSamsMatches(matchesQueryOptions ?? { range: "future" });

  const currentMonth = dayjs().month() + 1;
  const isOffSeason = currentMonth >= 5 && currentMonth <= 9;

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

  if (matchesData?.matches && matchesData.matches.length > 0) {
    const timestampDate = matchesData.timestamp ? new Date(matchesData.timestamp) : undefined;
    return (
      <Card>
        <Title order={2} c="blumine">
          Ligaspiele
        </Title>
        <Matches matches={matchesData.matches} timestamp={timestampDate} type="future" />
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
