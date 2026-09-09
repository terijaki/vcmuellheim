import { Card, CardSection, Loader, SimpleGrid, Stack, Text } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import CardTitle from "@webapp/components/CardTitle";
import PageWithHeading from "@webapp/components/layout/PageWithHeading";
import Matches from "@webapp/components/Matches";
import RankingTable from "@webapp/components/RankingTable";
import { useSamsMatches } from "@webapp/hooks/dataQueries";
import { getCurrentTabelleFn, getCurrentTermineFn } from "@webapp/server/functions/sams";
import { listTeamsFn } from "@webapp/server/functions/teams";
import { buildSamsMatchesHookOptions } from "@webapp/utils/sams-ssr";
import { numToWord } from "num-words-de";
import type { RankingResponse } from "@/lambda/sams/types";
import type { SamsMatchesHookOptions } from "@webapp/utils/sams-ssr";

export const Route = createFileRoute("/_layout/tabelle")({
  /**
   * SSR loads application Tabelle/Termine read models — no season/club discovery.
   * See docs/adr/0001-sams-match-loading.md and issue #391.
   */
  loader: async () => {
    const [tabelle, teams, pastTermine] = await Promise.all([
      getCurrentTabelleFn(),
      listTeamsFn(),
      getCurrentTermineFn({ data: { range: "past", limit: 20 } }),
    ]);

    const matchesInput = { range: "past" as const, limit: tabelle.lastResultCap };
    const pastMatches = pastTermine.matches.slice(0, tabelle.lastResultCap);
    const cached =
      pastMatches.length > 0 ? { matches: pastMatches, timestamp: pastTermine.timestamp } : null;
    const matchesQueryOptions: SamsMatchesHookOptions = buildSamsMatchesHookOptions(
      matchesInput,
      cached,
    );

    return {
      leagueUuids: tabelle.leagueUuids,
      teams: teams.items,
      lastResultCap: tabelle.lastResultCap,
      rankingsByLeagueUuid: tabelle.rankingsByLeagueUuid satisfies Record<string, RankingResponse>,
      ownedTeamUuids: tabelle.ownedTeamUuids,
      matchesQueryOptions,
    };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const {
    leagueUuids,
    teams,
    lastResultCap,
    rankingsByLeagueUuid,
    ownedTeamUuids,
    matchesQueryOptions,
  } = Route.useLoaderData();

  const {
    data: matchesData,
    isLoading: isLoadingMatches,
    isError: isMatchesError,
  } = useSamsMatches(matchesQueryOptions ?? { range: "past", limit: lastResultCap });
  const recentMatches = matchesData?.matches ?? [];
  const lastResultWord =
    recentMatches.length > 1 && numToWord(recentMatches.length, { uppercase: false });

  return (
    <PageWithHeading title={"Tabelle"}>
      <Stack>
        {leagueUuids.length === 0 && <NoRankingsData />}
        {leagueUuids.length > 0 && (
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
            {leagueUuids.map((leagueUuid) => (
              <RankingTable
                key={leagueUuid}
                leagueUuid={leagueUuid}
                initialData={rankingsByLeagueUuid[leagueUuid]}
                linkToTeamPage={true}
                clubsTeams={teams}
              />
            ))}
          </SimpleGrid>
        )}
        {isLoadingMatches && <MatchesLoadingState />}
        {!isLoadingMatches && isMatchesError && <MatchesErrorState />}
        {!isLoadingMatches && !isMatchesError && recentMatches.length > 0 && (
          <Card>
            <CardTitle>Unsere letzten {lastResultWord} Spiele</CardTitle>
            <CardSection p={{ base: undefined, sm: "sm" }}>
              <Matches
                matches={recentMatches}
                type="past"
                ownedTeamUuids={ownedTeamUuids}
                leagueNameByUuid={Object.fromEntries(
                  leagueUuids.map((leagueUuid) => [
                    leagueUuid,
                    rankingsByLeagueUuid[leagueUuid]?.leagueName ?? "",
                  ]),
                )}
              />
            </CardSection>
          </Card>
        )}
      </Stack>
    </PageWithHeading>
  );
}

function MatchesLoadingState() {
  return (
    <Card>
      <CardTitle>Letzte Spiele</CardTitle>
      <Stack align="center" py="md" gap="xs">
        <Loader size="sm" />
        <Text c="dimmed" size="sm">
          Lade letzte Spiele...
        </Text>
      </Stack>
    </Card>
  );
}

function MatchesErrorState() {
  return (
    <Card>
      <CardTitle>Fehler beim Laden der letzten Spiele</CardTitle>
      <Text>
        Die letzten Spielresultate konnten derzeit nicht geladen werden. Bitte versuche es später
        erneut.
      </Text>
    </Card>
  );
}

function NoRankingsData() {
  const currentMonth = new Date().getMonth() + 1;
  return (
    <>
      <Card>
        <CardTitle>Keine Daten gefunden</CardTitle>
        <Text>
          Tablleninformationen stehen aktuell nicht zur Verfügung. Eventuell liegt ein technisches
          Problem vor, oder es ist einfach der falsche Zeitpunkt.
        </Text>
      </Card>
      {currentMonth >= 4 && currentMonth <= 9 && (
        <Card>
          <CardTitle>Außerhalb der Saison?</CardTitle>
          <Text>
            Die Saison im Hallenvolleyball findet in der Regel in den Monaten von September bis
            April statt. Dazwischen und kurz vor Saisonbeginn, wurden die neusten Informationen vom
            Südbadischen Volleyballverband ggf. noch nicht veröffentlicht.
          </Text>
        </Card>
      )}
    </>
  );
}
