import {
  Anchor,
  BackgroundImage,
  Badge,
  Box,
  Card,
  Center,
  Container,
  Flex,
  Group,
  List,
  ListItem,
  Overlay,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import dayjs from "dayjs";
import "dayjs/locale/de";
import type { Event } from "@/lib/db/types";
import type { HeimspielCard } from "@/lib/db/schemas";
import { useEvents, useHomeHeimspiele, useLiveTicker } from "../../hooks/dataQueries";
import EventCard from "../EventCard";
import MapsLink from "../MapsLink";
import ScrollAnchor from "./ScrollAnchor";

dayjs.locale("de");

const TIME_RANGE = 14; // controls the empty-state copy
const TIME_RANGE_MAX_MULTIPLIER = 3;

export default function HomeHeimspiele({
  initialEvents,
  initialHeimspiele,
}: {
  initialEvents?: Awaited<ReturnType<typeof useEvents>>["data"];
  initialHeimspiele?: Awaited<ReturnType<typeof useHomeHeimspiele>>["data"];
} = {}) {
  const { data: eventsData, isPending: eventsPending } = useEvents(
    initialEvents ? { initialData: initialEvents } : undefined,
  );
  const events = eventsData?.items || [];

  const { data: heimspieleData, isPending: heimspielePending } = useHomeHeimspiele(
    initialHeimspiele ? { initialData: initialHeimspiele } : undefined,
  );
  const homeMatchesToDisplay = heimspieleData?.games ?? [];
  const isLoading = (eventsPending && !eventsData) || (heimspielePending && !heimspieleData);

  return (
    <Box bg="blumine">
      <ScrollAnchor name="heimspiele" />
      <BackgroundImage
        src="/assets/backgrounds/pageheading.jpg"
        py="md"
        style={{ zIndex: 0 }}
        pos="relative"
      >
        <Container size="xl" px={{ base: "lg", md: "xl" }}>
          <Stack>
            {/* EVENTS */}
            <EventsList events={events} />

            {/* MATCHES */}
            {isLoading ? (
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                <Skeleton height={160} />
                <Skeleton height={160} />
              </SimpleGrid>
            ) : (
              <HomeMatchesList homeMatches={homeMatchesToDisplay} />
            )}
          </Stack>
        </Container>

        <NoMatchesNoEvents
          matchCount={isLoading ? undefined : homeMatchesToDisplay.length}
          eventCount={isLoading ? undefined : events.length}
        />

        <Overlay
          backgroundOpacity={0.9}
          color="var(--mantine-color-blumine-filled)"
          blur={2}
          zIndex={-1}
        />
      </BackgroundImage>
    </Box>
  );
}

function EventsList({ events }: { events: Event[] }) {
  if (!events || events.length === 0) return null;
  const isMultiple = events.length > 1;
  return (
    <>
      <Stack gap={0}>
        <Title order={2} c="white">
          {isMultiple ? "Termine" : "Termin"}
        </Title>
        <Text c="white">
          {isMultiple ? "Bevorstehende Vereinstermine" : "Bevorstehender Termin"}
        </Text>
      </Stack>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        {events.map((event) => (
          <EventCard {...event} key={event.id} dark />
        ))}
      </SimpleGrid>
    </>
  );
}

function HomeMatchesList({ homeMatches }: { homeMatches: HeimspielCard[] }) {
  const { data: tickerData } = useLiveTicker();

  if (!homeMatches || homeMatches.length === 0) return null;

  type GroupedMatches = Record<string, Record<string, HeimspielCard[]>>;

  const groupedMatches = homeMatches.reduce<GroupedMatches>((acc, match) => {
    const dateFormatted = dayjs(match.date).format("YYYY-MM-DD");
    const locationUuid = match.locationUuid || "unknown_location";
    const primaryKey = `${dateFormatted}_${locationUuid}`;
    const secondaryKey = match.leagueUuid || "unknown_league";
    if (!acc[primaryKey]) acc[primaryKey] = {};
    if (!acc[primaryKey][secondaryKey]) acc[primaryKey][secondaryKey] = [];
    acc[primaryKey][secondaryKey].push(match);
    return acc;
  }, {});

  return (
    <Stack>
      <Stack gap={0}>
        <Title order={2} c="white">
          {homeMatches.length > 0
            ? "Wir laden ein zum Heimspiel!"
            : "bevorstehende Veranstaltungen"}
        </Title>
        <Text c="white">
          In den kommenden Tagen spielen wir in Müllheim und freuen uns über jeden Zuschauer!
        </Text>
      </Stack>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        {Object.entries(groupedMatches).map(([dateLocationKey, leagueGroups]) => {
          const [date, _locationUuid] = dateLocationKey.split("_");
          const firstLeagueMatches = Object.values(leagueGroups)[0];
          const locationName = firstLeagueMatches?.[0]?.locationName;

          // Check if any match in this card group is currently live
          const allMatchesInCard = Object.values(leagueGroups).flat();
          const isCardLive = allMatchesInCard.some((match) => {
            const t1 = match.team1Uuid;
            const t2 = match.team2Uuid;
            return tickerData?.liveMatches.some(
              (lm) =>
                lm.state.started &&
                !lm.state.finished &&
                ((lm.team1Uuid === t1 && lm.team2Uuid === t2) ||
                  (lm.team1Uuid === t2 && lm.team2Uuid === t1)),
            );
          });

          // NEW CARD PER DATE AND LOCATION COMBO
          return (
            <Card bg="onyx" c="white" key={dateLocationKey}>
              <Stack>
                <Flex
                  direction={{ base: "column", sm: "row" }}
                  justify="space-between"
                  align={{ base: "flex-start", sm: "center" }}
                  columnGap="sm"
                >
                  <Group gap="xs">
                    <time dateTime={date}>
                      <Text c="lion" fw="bold">
                        {dayjs(date).format("dddd, D MMMM YY")}
                      </Text>
                    </time>
                    {isCardLive && (
                      <Badge color="red" variant="filled" size="sm">
                        LIVE
                      </Badge>
                    )}
                  </Group>
                  <MapsLink name={locationName} />
                </Flex>
                {Object.entries(leagueGroups).map(([leagueUuid, matches]) => {
                  const leagueName = matches[0]?.leagueName;
                  const matchesArray = matches;
                  const earliestStartTime = matchesArray.reduce((earliest, match) => {
                    const currentTime = dayjs(match.time, "HH:mm");
                    return currentTime.isBefore(dayjs(earliest, "HH:mm")) ? match.time : earliest;
                  }, matchesArray[0]?.time);

                  // NEW STACK PER LEAGUE (INSIDE THE DATE AND LOCATION CARD)
                  return (
                    <Stack key={leagueUuid} gap={0}>
                      {/* LEAGUE NAME AND TIME */}
                      <Group gap="xs">
                        {leagueName && <Text fw="bold">{leagueName}</Text>}
                        {earliestStartTime && earliestStartTime === "00:00" ? (
                          <Text>(Uhrzeit folgt)</Text>
                        ) : (
                          <Text>ab {earliestStartTime} Uhr</Text>
                        )}
                      </Group>
                      {/* GUESTS LIST */}
                      <List spacing={0} withPadding listStyleType="none">
                        {matchesArray.map((match) => {
                          return (
                            <ListItem key={match.matchUuid} opacity={0.8}>
                              {match.opponentName}
                            </ListItem>
                          );
                        })}
                      </List>
                    </Stack>
                  );
                })}
              </Stack>
            </Card>
          );
        })}
      </SimpleGrid>
      <Center my="md">
        <Text c="white">
          Auswärtsspiele findest du im Spielplan der jeweiligen Mannschaft. <LinkToEventsPage />
        </Text>
      </Center>
    </Stack>
  );
}

export function shouldShowNoHeimspiele({
  isLoading,
  matchCount,
  eventCount,
}: {
  isLoading: boolean;
  matchCount: number;
  eventCount: number;
}): boolean {
  if (isLoading) return false;
  return matchCount === 0 && eventCount === 0;
}

function NoMatchesNoEvents({
  matchCount,
  eventCount,
}: {
  matchCount?: number;
  eventCount?: number;
}) {
  if (matchCount === undefined || eventCount === undefined) return null;
  if (!shouldShowNoHeimspiele({ isLoading: false, matchCount, eventCount })) return null;

  const weeksCount = Math.round((TIME_RANGE * TIME_RANGE_MAX_MULTIPLIER) / 7);

  return (
    <Container py="md">
      <Stack c="white" gap={0}>
        <Title order={2} c="white">
          {eventCount >= 1 && matchCount === 0 && "Zunächst keine Veranstaltungen"}
          {eventCount === 0 && matchCount === 0 && "Zunächst keine Heimspiele"}
        </Title>
        <Text>
          In den kommenden {weeksCount} Wochen stehen keine
          {matchCount >= 1 ? " Veranstaltungen " : " Spiele in Müllheim "}
          an.
          {matchCount >= 1 && (
            <Text span>
              {" "}
              {matchCount === 1
                ? "Einen weiteren Termin zu einem späteren Zeitpunkt findest du"
                : `${matchCount} weitere Termine zu einem späteren Zeitpunkt findest du`}
              <LinkToEventsPage />
            </Text>
          )}
        </Text>

        {matchCount >= 1 && (
          <Text>
            Auswärtsspiele findest du im Spielplan der jeweiligen Mannschaft.
            <Text span>
              {" "}
              {matchCount === 1
                ? "Einen weiteren Termin findest du"
                : `${matchCount} weitere Termine unserer Mannschaften findest du`}
            </Text>
            <LinkToEventsPage />
          </Text>
        )}
      </Stack>
    </Container>
  );
}

function LinkToEventsPage() {
  return (
    <Text span>
      <Text span>» </Text>
      <Anchor href="termine" fw="bold" c="white">
        hier
      </Anchor>
      <Text span> «</Text>
    </Text>
  );
}
