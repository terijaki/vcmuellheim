import { Paper, Stack, Table, Text, Title, Tooltip } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { trpc } from "../../lib/trpc";

function SamsDashboardPage() {
	const { data: samsTeams, isLoading: teamsLoading } = trpc.samsTeams.list.useQuery();
	const { data: samsClubs, isLoading: clubsLoading } = trpc.samsClubs.list.useQuery();

	const teams = samsTeams?.items || [];
	const clubs = samsClubs?.items || [];

	return (
		<Stack gap="md">
			<Title order={2}>SAMS Teams</Title>
			<Paper withBorder p="md">
				{teamsLoading ? (
					<Text>Laden...</Text>
				) : teams && teams.length > 0 ? (
					<Table striped highlightOnHover>
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Name</Table.Th>
								<Table.Th>ID</Table.Th>
								<Table.Th>League</Table.Th>
								<Table.Th visibleFrom="md">Sportsclub ID</Table.Th>
								<Table.Th hiddenFrom="md">Club</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{teams.map((team) => (
								<Table.Tr key={team.uuid}>
									<Table.Td style={{ whiteSpace: "nowrap" }}>{team.name}</Table.Td>
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
									<Table.Td style={{ whiteSpace: "nowrap" }}>{team.leagueName || "-"}</Table.Td>
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
				) : (
					<Text>Keine SAMS Teams gefunden</Text>
				)}
			</Paper>

			<Title order={2} mt="lg">
				SAMS Vereine
			</Title>
			<Paper withBorder p="md">
				{clubsLoading ? (
					<Text>Laden...</Text>
				) : clubs && clubs.length > 0 ? (
					<Table striped highlightOnHover>
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Name</Table.Th>
								<Table.Th>ID</Table.Th>
								<Table.Th>Verband</Table.Th>
								<Table.Th>Verbands-ID</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{clubs.map((club) => (
								<Table.Tr key={club.sportsclubUuid}>
									<Table.Td>{club.name}</Table.Td>
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
									<Table.Td>
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
				) : (
					<Text>Keine SAMS Vereine gefunden</Text>
				)}
			</Paper>
		</Stack>
	);
}

export const Route = createFileRoute("/dashboard/sams")({
	component: SamsDashboardPage,
});
