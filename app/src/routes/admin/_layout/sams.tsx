import { Card, Stack, Table, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import ClubLogo from "@webapp/components/ClubLogo";
import {
  getSamsProjectionFreshnessFn,
  listSamsClubsFn,
  listSamsTeamsFn,
} from "@webapp/server/functions/sams";
import dayjs from "dayjs";
function SamsDashboardPage() {
  const { data: teamsData, isLoading: teamsLoading } = useQuery({
    queryKey: ["sams", "teams"],
    queryFn: () => listSamsTeamsFn(),
  });
  const { data: clubsData, isLoading: clubsLoading } = useQuery({
    queryKey: ["sams", "clubs"],
    queryFn: () => listSamsClubsFn(),
  });
  const { data: freshness } = useQuery({
    queryKey: ["sams", "projection-freshness"],
    queryFn: () => getSamsProjectionFreshnessFn(),
  });
  const teams = teamsData?.items ?? [];
  const clubs = clubsData?.items ?? [];
  return (
    <Stack gap="md">
      {freshness?.maxUpdatedAt && (
        <Text size="sm" c="dimmed">
          Projektionen zuletzt aktualisiert:{" "}
          {dayjs(freshness.maxUpdatedAt).format("DD.MM.YY HH:mm")}
        </Text>
      )}
      <Title order={2}>SAMS Teams</Title>
      {teamsLoading ? (
        <Text>Laden...</Text>
      ) : teams.length ? (
        <Card withBorder>
          <Table>
            <Table.Tbody>
              {teams.map((t) => (
                <Table.Tr key={t.uuid}>
                  <Table.Td>
                    <ClubLogo clubUuid={t.sportsclubUuid} label={t.name} />
                  </Table.Td>
                  <Table.Td>{t.name}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      ) : (
        <Text>Keine SAMS Teams gefunden</Text>
      )}
      <Title order={2}>SAMS Vereine</Title>
      {clubsLoading ? (
        <Text>Laden...</Text>
      ) : clubs.length ? (
        <Card withBorder>
          <Table>
            <Table.Tbody>
              {clubs.map((c) => (
                <Table.Tr key={c.sportsclubUuid}>
                  <Table.Td>
                    <ClubLogo clubUuid={c.sportsclubUuid} label={c.name} />
                  </Table.Td>
                  <Table.Td>{c.name}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      ) : (
        <Text>Keine SAMS Vereine gefunden</Text>
      )}
    </Stack>
  );
}
export const Route = createFileRoute("/admin/_layout/sams")({ component: SamsDashboardPage });
