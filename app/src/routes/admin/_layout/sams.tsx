import { Card, Group, Loader, Stack, Table, Text, Title, Tooltip, ActionIcon } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import ClubLogo from "@webapp/components/ClubLogo";
import {
  listSamsClubsFn,
  listSamsTeamsFn,
  triggerSamsClubsSyncFn,
  triggerSamsTeamsSyncFn,
} from "@webapp/server/functions/sams";
import dayjs from "dayjs";
import { Info, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const adminLayoutRoute = getRouteApi("/admin/_layout");

const IS_DEV = import.meta.env.DEV;
const SYNC_COOLDOWN_MS = 3 * 60 * 1000;
const POLL_INTERVAL_MS = 20_000;

function SamsDashboardPage() {
  const { user } = adminLayoutRoute.useRouteContext();
  const isAdmin = user.authRole === "Admin";
  const queryClient = useQueryClient();

  const [clubsSyncTriggeredAt, setClubsSyncTriggeredAt] = useState<number | null>(null);
  const [teamsSyncTriggeredAt, setTeamsSyncTriggeredAt] = useState<number | null>(null);

  const clubsPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const teamsPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clubsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const teamsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: samsTeamsData, isLoading: teamsLoading } = useQuery({
    queryKey: ["sams", "teams"],
    queryFn: () => listSamsTeamsFn(),
  });
  const { data: samsClubsData, isLoading: clubsLoading } = useQuery({
    queryKey: ["sams", "clubs"],
    queryFn: () => listSamsClubsFn(),
  });
  const teams = samsTeamsData?.items || [];
  const clubs = samsClubsData?.items || [];

  const teamsLastSynced =
    teams.length > 0
      ? teams.reduce((max, t) => (t.updatedAt > max ? t.updatedAt : max), teams[0].updatedAt)
      : null;
  const clubsLastSynced =
    clubs.length > 0
      ? clubs.reduce((max, c) => (c.updatedAt > max ? c.updatedAt : max), clubs[0].updatedAt)
      : null;

  const teamsRecentlySynced =
    teamsLastSynced !== null && Date.now() - new Date(teamsLastSynced).getTime() < SYNC_COOLDOWN_MS;
  const clubsRecentlySynced =
    clubsLastSynced !== null && Date.now() - new Date(clubsLastSynced).getTime() < SYNC_COOLDOWN_MS;

  const stopSync = (
    setTriggeredAt: React.Dispatch<React.SetStateAction<number | null>>,
    pollRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
    timeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  ) => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setTriggeredAt(null);
  };

  const startSync = (
    setTriggeredAt: React.Dispatch<React.SetStateAction<number | null>>,
    pollRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
    timeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  ) => {
    setTriggeredAt(Date.now());
    pollRef.current = setInterval(() => {
      queryClient.invalidateQueries();
    }, POLL_INTERVAL_MS);
    timeoutRef.current = setTimeout(() => {
      stopSync(setTriggeredAt, pollRef, timeoutRef);
    }, SYNC_COOLDOWN_MS);
  };

  // Stop polling when fresh data arrives (updatedAt newer than trigger time)
  useEffect(() => {
    if (
      clubsSyncTriggeredAt !== null &&
      clubsLastSynced !== null &&
      new Date(clubsLastSynced).getTime() > clubsSyncTriggeredAt
    ) {
      stopSync(setClubsSyncTriggeredAt, clubsPollRef, clubsTimeoutRef);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubsLastSynced]);

  useEffect(() => {
    if (
      teamsSyncTriggeredAt !== null &&
      teamsLastSynced !== null &&
      new Date(teamsLastSynced).getTime() > teamsSyncTriggeredAt
    ) {
      stopSync(setTeamsSyncTriggeredAt, teamsPollRef, teamsTimeoutRef);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamsLastSynced]);

  useEffect(() => {
    const clubsPoll = clubsPollRef;
    const teamsPoll = teamsPollRef;
    const clubsTimeout = clubsTimeoutRef;
    const teamsTimeout = teamsTimeoutRef;
    return () => {
      if (clubsPoll.current !== null) clearInterval(clubsPoll.current);
      if (teamsPoll.current !== null) clearInterval(teamsPoll.current);
      if (clubsTimeout.current !== null) clearTimeout(clubsTimeout.current);
      if (teamsTimeout.current !== null) clearTimeout(teamsTimeout.current);
    };
  }, []);

  const clubsMutation = useMutation({
    mutationFn: () => triggerSamsClubsSyncFn(),
    onSuccess: () => {
      notifications.show({
        message: "Sync erfolgreich ausgelöst",
        color: "green",
        autoClose: 3000,
      });
      startSync(setClubsSyncTriggeredAt, clubsPollRef, clubsTimeoutRef);
    },
    onError: (error: Error) => {
      notifications.show({
        title: "Fehler",
        message: `Sync konnte nicht ausgelöst werden: ${error.message}`,
        color: "red",
        autoClose: 5000,
      });
    },
  });

  const teamsMutation = useMutation({
    mutationFn: () => triggerSamsTeamsSyncFn(),
    onSuccess: () => {
      notifications.show({
        message: "Sync erfolgreich ausgelöst",
        color: "green",
        autoClose: 3000,
      });
      startSync(setTeamsSyncTriggeredAt, teamsPollRef, teamsTimeoutRef);
    },
    onError: (error: Error) => {
      notifications.show({
        title: "Fehler",
        message: `Sync konnte nicht ausgelöst werden: ${error.message}`,
        color: "red",
        autoClose: 5000,
      });
    },
  });

  return (
    <Stack gap="md">
      <Group align="flex-end" justify="space-between" gap="md" wrap="wrap">
        <Title order={2}>SAMS Teams</Title>
        {isAdmin && (
          <Stack gap={4} ml="auto">
            <Group gap="xs" align="center">
              {teamsLastSynced && (
                <Text size="xs" c="dimmed">
                  Zuletzt synchronisiert: {dayjs(teamsLastSynced).format("DD.MM.YY HH:mm")}
                </Text>
              )}
              <Tooltip
                label={
                  IS_DEV
                    ? "Sync nur deployed verfügbar"
                    : "Kürzlich synchronisiert — bitte 3 Minuten warten"
                }
                disabled={!IS_DEV && !teamsRecentlySynced && teamsSyncTriggeredAt === null}
              >
                {teamsSyncTriggeredAt !== null ? (
                  <Loader size="xs" />
                ) : (
                  <ActionIcon
                    size="sm"
                    radius="xl"
                    variant="light"
                    disabled={IS_DEV || teamsRecentlySynced}
                    onClick={() => teamsMutation.mutate()}
                  >
                    <RefreshCw style={{ padding: 2 }} />
                  </ActionIcon>
                )}
              </Tooltip>
            </Group>
          </Stack>
        )}
      </Group>
      {teamsLoading ? (
        <Text>Laden...</Text>
      ) : teams && teams.length > 0 ? (
        <Card withBorder bg="white" p={0} radius="md">
          <Table striped highlightOnHover horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={40}>Logo</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>ID</Table.Th>
                <Table.Th visibleFrom="md">League</Table.Th>
                <Table.Th visibleFrom="md">Sportsclub ID</Table.Th>
                <Table.Th hiddenFrom="md">Club</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {teams.map((team) => (
                <Table.Tr key={team.uuid}>
                  <Table.Td>
                    <ClubLogo clubUuid={team.sportsclubUuid} label={team.name} />
                  </Table.Td>
                  <Table.Td style={{ whiteSpace: "nowrap" }}>
                    {team.name}
                    <Text size="xs" hiddenFrom="md">
                      {team.leagueName || "-"}
                    </Text>
                  </Table.Td>
                  <Table.Td visibleFrom="md">
                    <Text size="xs" c="dimmed">
                      {team.uuid || "-"}
                    </Text>
                  </Table.Td>
                  <Table.Td hiddenFrom="md">
                    <Tooltip label={team.uuid}>
                      <Info size={16} />
                    </Tooltip>
                  </Table.Td>
                  <Table.Td visibleFrom="md">{team.leagueName || "-"}</Table.Td>
                  <Table.Td visibleFrom="md">
                    <Text size="xs" c="dimmed">
                      {team.sportsclubUuid || "-"}
                    </Text>
                  </Table.Td>
                  <Table.Td hiddenFrom="md">
                    <Tooltip label={team.sportsclubUuid}>
                      <Info size={16} />
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      ) : (
        <Text>Keine SAMS Teams gefunden</Text>
      )}

      <Group align="flex-end" justify="space-between" gap="md" mt="lg" wrap="wrap">
        <Title order={2}>SAMS Vereine</Title>
        {isAdmin && (
          <Stack gap={4} ml="auto">
            <Group gap="xs" align="center">
              {clubsLastSynced && (
                <Text size="xs" c="dimmed">
                  Zuletzt synchronisiert: {dayjs(clubsLastSynced).format("DD.MM.YY HH:mm")}
                </Text>
              )}
              <Tooltip
                label={
                  IS_DEV
                    ? "Sync nur deployed verfügbar"
                    : "Kürzlich synchronisiert — bitte 3 Minuten warten"
                }
                disabled={!IS_DEV && !clubsRecentlySynced && clubsSyncTriggeredAt === null}
              >
                {clubsSyncTriggeredAt !== null ? (
                  <Loader size="xs" />
                ) : (
                  <ActionIcon
                    size="sm"
                    variant="light"
                    radius="xl"
                    disabled={IS_DEV || clubsRecentlySynced}
                    onClick={() => clubsMutation.mutate()}
                  >
                    <RefreshCw style={{ padding: 2 }} />
                  </ActionIcon>
                )}
              </Tooltip>
            </Group>
          </Stack>
        )}
      </Group>
      {clubsLoading ? (
        <Text>Laden...</Text>
      ) : clubs && clubs.length > 0 ? (
        <Card withBorder bg="white" p={0} radius="md">
          <Table striped highlightOnHover horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={40}>Logo</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>ID</Table.Th>
                <Table.Th visibleFrom="md">Verband</Table.Th>
                <Table.Th>Verbands-ID</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {clubs.map((club) => (
                <Table.Tr key={club.sportsclubUuid}>
                  <Table.Td>
                    <ClubLogo clubUuid={club.sportsclubUuid} label={club.name} />
                  </Table.Td>
                  <Table.Td>
                    {club.name}
                    <Text size="xs" c="dimmed" hiddenFrom="md">
                      {club.associationName || "-"}
                    </Text>
                  </Table.Td>
                  <Table.Td visibleFrom="md">
                    <Text size="xs" c="dimmed">
                      {club.sportsclubUuid}
                    </Text>
                  </Table.Td>
                  <Table.Td hiddenFrom="md">
                    <Tooltip label={club.sportsclubUuid}>
                      <Info size={16} />
                    </Tooltip>
                  </Table.Td>
                  <Table.Td visibleFrom="md">
                    <Text size="xs">{club.associationName || "-"}</Text>
                  </Table.Td>
                  <Table.Td visibleFrom="md">
                    <Text size={"xs"} c="dimmed">
                      {club.associationUuid || "-"}
                    </Text>
                  </Table.Td>
                  <Table.Td hiddenFrom="md">
                    <Tooltip label={club.associationUuid}>
                      <Info size={16} />
                    </Tooltip>
                  </Table.Td>
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

export const Route = createFileRoute("/admin/_layout/sams")({
  component: SamsDashboardPage,
});
