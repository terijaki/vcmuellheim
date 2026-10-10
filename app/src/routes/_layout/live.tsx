import { Center, Stack, Text, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { getOwnedSamsTeamUuids } from "@/utils/sams";
import CenteredLoader from "@webapp/components/CenteredLoader";
import HomeLiveTicker from "@webapp/components/homepage/HomeLiveTicker";
import PageWithHeading from "@webapp/components/layout/PageWithHeading";
import Matches from "@webapp/components/Matches";
import { useSamsMatches, useSamsTeams } from "@webapp/hooks/dataQueries";
import { useHomeLiveTickerData } from "@webapp/hooks/useHomeLiveTicker";
import { filterTodaysUpcomingMatches } from "@webapp/utils/liveTodayPreview";

export const Route = createFileRoute("/_layout/live")({
  component: LivePage,
});

function LivePage() {
  const { ourMatches, hasMatchesToday, hasOpenMatches, isPending } = useHomeLiveTickerData();
  const { data: samsTeamsData } = useSamsTeams();
  const { data: matchesData } = useSamsMatches({ range: "future" });

  const liveMatchUuids = new Set(ourMatches.map((match) => match.matchUuid));
  const upcomingToday = filterTodaysUpcomingMatches(matchesData?.matches ?? [], liveMatchUuids);
  const ownedTeamUuids = [...getOwnedSamsTeamUuids(samsTeamsData?.teams ?? [])];
  const hasUpcomingToday = upcomingToday.length > 0;

  const subtitle = isPending
    ? "Lade aktuelle Spiele…"
    : hasOpenMatches
      ? "Unsere Mannschaften spielen gerade!"
      : hasUpcomingToday
        ? "Unsere Mannschaften spielen heute!"
        : hasMatchesToday
          ? "Unsere Mannschaften haben heute gespielt!"
          : undefined;

  return (
    <PageWithHeading
      title="Live"
      description="Live-Ergebnisse der Mannschaften vom Volleyballclub Müllheim"
      subtitle={subtitle}
    >
      <Stack gap="xl">
        {isPending ? (
          <CenteredLoader text="Lade Live-Ergebnisse…" />
        ) : !hasMatchesToday ? (
          <Center py="xl">
            <Stack gap="xs" align="center">
              <Text ta="center" fw={500}>
                Aktuell keine Live-Spiele
              </Text>
              <Text ta="center" c="dimmed" size="sm">
                Hier erscheinen Ergebnisse, sobald unsere Mannschaften heute spielen.
              </Text>
            </Stack>
          </Center>
        ) : (
          <HomeLiveTicker matches={ourMatches} embedded />
        )}

        {hasUpcomingToday && (
          <Stack gap="sm">
            <Stack gap={4}>
              <Title order={2} c="blumine">
                Heute anstehend
              </Title>
              <Text c="dimmed" size="sm">
                Geplante Spiele unserer Mannschaften
              </Text>
            </Stack>
            <Matches matches={upcomingToday} type="future" ownedTeamUuids={ownedTeamUuids} />
          </Stack>
        )}
      </Stack>
    </PageWithHeading>
  );
}
