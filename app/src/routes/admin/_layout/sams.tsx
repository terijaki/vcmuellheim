import { Button, Card, Group, Progress, Stack, Table, Text, Title, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import ClubLogo from "@webapp/components/ClubLogo";
import { listSamsClubsFn, listSamsTeamsFn, triggerSamsClubsSyncFn, triggerSamsTeamsSyncFn } from "@webapp/server/functions/sams";
import dayjs from "dayjs";
import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const adminLayoutRoute = getRouteApi("/admin/_layout");

const IS_DEV = import.meta.env.DEV;
const SYNC_DURATION_SECONDS = 180;
const TICK_INTERVAL_MS = 500;
const PROGRESS_PER_TICK = 100 / (SYNC_DURATION_SECONDS * (1000 / TICK_INTERVAL_MS));

function SamsDashboardPage() {
	const { user } = adminLayoutRoute.useRouteContext();
	const isAdmin = user.role === "Admin";
	const queryClient = useQueryClient();

	const [clubsCooldown, setClubsCooldown] = useState(false);
	const [teamsCooldown, setTeamsCooldown] = useState(false);
	const [clubsProgress, setClubsProgress] = useState<number | null>(null);
	const [teamsProgress, setTeamsProgress] = useState<number | null>(null);

	const clubsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const teamsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const startProgress = (
		setProgress: React.Dispatch<React.SetStateAction<number | null>>,
		setCooldown: React.Dispatch<React.SetStateAction<boolean>>,
		intervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
	) => {
		setProgress(0);
		intervalRef.current = setInterval(() => {
			setProgress((prev) => {
				const next = (prev ?? 0) + PROGRESS_PER_TICK;
				if (next >= 100) {
					if (intervalRef.current !== null) {
						clearInterval(intervalRef.current);
						intervalRef.current = null;
					}
					queryClient.invalidateQueries();
					setCooldown(false);
					return null;
				}
				return next;
			});
		}, TICK_INTERVAL_MS);
	};

	useEffect(() => {
		const clubsInterval = clubsIntervalRef;
		const teamsInterval = teamsIntervalRef;
		return () => {
			if (clubsInterval.current !== null) clearInterval(clubsInterval.current);
			if (teamsInterval.current !== null) clearInterval(teamsInterval.current);
		};
	}, []);

	const clubsMutation = useMutation({
		mutationFn: () => triggerSamsClubsSyncFn(),
		onSuccess: () => {
			notifications.show({ message: "Sync erfolgreich ausgelöst", color: "green", autoClose: 3000 });
			setClubsCooldown(true);
			startProgress(setClubsProgress, setClubsCooldown, clubsIntervalRef);
		},
		onError: (error: Error) => {
			notifications.show({ title: "Fehler", message: `Sync konnte nicht ausgelöst werden: ${error.message}`, color: "red", autoClose: 5000 });
		},
	});

	const teamsMutation = useMutation({
		mutationFn: () => triggerSamsTeamsSyncFn(),
		onSuccess: () => {
			notifications.show({ message: "Sync erfolgreich ausgelöst", color: "green", autoClose: 3000 });
			setTeamsCooldown(true);
			startProgress(setTeamsProgress, setTeamsCooldown, teamsIntervalRef);
		},
		onError: (error: Error) => {
			notifications.show({ title: "Fehler", message: `Sync konnte nicht ausgelöst werden: ${error.message}`, color: "red", autoClose: 5000 });
		},
	});

	const { data: samsTeamsData, isLoading: teamsLoading } = useQuery({ queryKey: ["sams", "teams"], queryFn: () => listSamsTeamsFn() });
	const { data: samsClubsData, isLoading: clubsLoading } = useQuery({ queryKey: ["sams", "clubs"], queryFn: () => listSamsClubsFn() });
	const teams = samsTeamsData?.items || [];
	const clubs = samsClubsData?.items || [];

	const teamsLastSynced = teams.length > 0 ? teams.reduce((max, t) => (t.updatedAt > max ? t.updatedAt : max), teams[0].updatedAt) : null;
	const clubsLastSynced = clubs.length > 0 ? clubs.reduce((max, c) => (c.updatedAt > max ? c.updatedAt : max), clubs[0].updatedAt) : null;

	return (
		<Stack gap="md">
			<Group align="flex-end" gap="md" wrap="wrap">
				<Title order={2}>SAMS Teams</Title>
				{isAdmin && (
					<Stack gap={4} style={{ flex: 1, minWidth: 200 }}>
						<Group gap="xs" align="center">
							{teamsLastSynced && (
								<Text size="xs" c="dimmed">
									Zuletzt synchronisiert: {dayjs(teamsLastSynced).format("DD.MM.YYYY HH:mm")}
								</Text>
							)}
							<Tooltip label={IS_DEV ? "Nur im Deployment verfügbar" : "Sync ausgelöst — bitte 3 Minuten warten"} disabled={!IS_DEV && !teamsCooldown}>
								<Button size="xs" variant="light" loading={teamsMutation.isPending} disabled={IS_DEV || teamsCooldown} onClick={() => teamsMutation.mutate()}>
									{IS_DEV ? "Sync (nur deployed)" : "Jetzt synchronisieren"}
								</Button>
							</Tooltip>
						</Group>
						{teamsProgress !== null && <Progress value={teamsProgress} size="sm" radius="xl" animated />}
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

			<Group align="flex-end" gap="md" mt="lg" wrap="wrap">
				<Title order={2}>SAMS Vereine</Title>
				{isAdmin && (
					<Stack gap={4} style={{ flex: 1, minWidth: 200 }}>
						<Group gap="xs" align="center">
							{clubsLastSynced && (
								<Text size="xs" c="dimmed">
									Zuletzt synchronisiert: {dayjs(clubsLastSynced).format("DD.MM.YYYY HH:mm")}
								</Text>
							)}
							<Tooltip label={IS_DEV ? "Nur im Deployment verfügbar" : "Sync ausgelöst — bitte 3 Minuten warten"} disabled={!IS_DEV && !clubsCooldown}>
								<Button size="xs" variant="light" loading={clubsMutation.isPending} disabled={IS_DEV || clubsCooldown} onClick={() => clubsMutation.mutate()}>
									{IS_DEV ? "Sync (nur deployed)" : "Jetzt synchronisieren"}
								</Button>
							</Tooltip>
						</Group>
						{clubsProgress !== null && <Progress value={clubsProgress} size="sm" radius="xl" animated />}
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
