import { Button, Group, Modal, Paper, Select, Stack, Table, Text, Textarea, TextInput, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import type { TeamInput } from "../../../../../lib/db/schemas";
import { slugify } from "../../../../../utils/slugify";
import { trpc } from "../../lib/trpc";

function TeamsPage() {
	const [opened, { open, close }] = useDisclosure(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [formData, setFormData] = useState<Partial<TeamInput>>({
		name: "",
		slug: "",
		description: "",
		sbvvTeamId: "",
		ageGroup: "",
		gender: undefined,
		league: "",
	});

	const { data: teams, isLoading, refetch } = trpc.teams.list.useQuery();
	const createMutation = trpc.teams.create.useMutation({
		onSuccess: () => {
			refetch();
			close();
			resetForm();
		},
	});
	const updateMutation = trpc.teams.update.useMutation({
		onSuccess: () => {
			refetch();
			close();
			resetForm();
		},
	});
	const deleteMutation = trpc.teams.delete.useMutation({
		onSuccess: () => {
			refetch();
		},
	});

	const resetForm = () => {
		setFormData({
			name: "",
			slug: "",
			description: "",
			sbvvTeamId: "",
			ageGroup: "",
			gender: undefined,
			league: "",
		});
		setEditingId(null);
	};

	const handleSubmit = () => {
		if (!formData.name || !formData.gender) return;

		const slug = slugify(formData.name);
		// Filter out empty strings to avoid DynamoDB GSI errors
		const cleanedData = Object.fromEntries(Object.entries({ ...formData, slug }).filter(([_, value]) => value !== "" && value !== undefined));

		if (editingId) {
			updateMutation.mutate({
				id: editingId,
				data: cleanedData,
			});
		} else {
			createMutation.mutate(cleanedData as TeamInput);
		}
	};

	const handleEdit = (team: TeamInput & { id: string }) => {
		setFormData({
			name: team.name,
			slug: team.slug,
			description: team.description || "",
			status: team.status,
			sbvvTeamId: team.sbvvTeamId || "",
			ageGroup: team.ageGroup || "",
			gender: team.gender,
			league: team.league || "",
		});
		setEditingId(team.id);
		open();
	};
	const handleDelete = (id: string) => {
		if (window.confirm("Möchten Sie diese Mannschaft wirklich löschen?")) {
			deleteMutation.mutate({ id });
		}
	};

	const handleOpenNew = () => {
		resetForm();
		open();
	};

	return (
		<Stack gap="md">
			<Group justify="space-between">
				<Title order={2}>Mannschaften</Title>
				<Button onClick={handleOpenNew}>Neue Mannschaft</Button>
			</Group>{" "}
			<Modal opened={opened} onClose={close} title={editingId ? "Mannschaft bearbeiten" : "Neue Mannschaft"} size="lg">
				<Stack gap="md">
					<TextInput label="Name" placeholder="z.B. 1. Herren" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />

					<Textarea label="Beschreibung" placeholder="Optionale Beschreibung..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} minRows={3} />

					<Select
						label="Geschlecht"
						placeholder="Wählen..."
						value={formData.gender}
						onChange={(value) => setFormData({ ...formData, gender: value as "male" | "female" | "mixed" | undefined })}
						data={[
							{ value: "male", label: "Männlich" },
							{ value: "female", label: "Weiblich" },
							{ value: "mixed", label: "Gemischt" },
						]}
						required
					/>

					<TextInput label="Mindestalter" placeholder="z.B. U19" value={formData.ageGroup} onChange={(e) => setFormData({ ...formData, ageGroup: e.target.value })} />

					<TextInput label="Liga" placeholder="z.B. Landesliga" value={formData.league} onChange={(e) => setFormData({ ...formData, league: e.target.value })} />

					<TextInput
						label="SBVV Team ID"
						placeholder="z.B. 123456"
						value={formData.sbvvTeamId}
						onChange={(e) => setFormData({ ...formData, sbvvTeamId: e.target.value })}
						description="SAMS/SBVV Team-ID für Spielpläne"
					/>

					<Group justify="flex-end" mt="md">
						<Button variant="subtle" onClick={close}>
							Abbrechen
						</Button>
						<Button onClick={handleSubmit} loading={createMutation.isPending || updateMutation.isPending} disabled={!formData.name || !formData.gender}>
							{editingId ? "Aktualisieren" : "Erstellen"}
						</Button>
					</Group>
				</Stack>
			</Modal>
			<Paper withBorder p="md">
				{isLoading ? (
					<Text>Laden...</Text>
				) : teams && teams.items.length > 0 ? (
					<Table striped highlightOnHover>
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Name</Table.Th>
								<Table.Th>Slug</Table.Th>
								<Table.Th>Status</Table.Th>
								<Table.Th>Liga</Table.Th>
								<Table.Th>Mindestalter</Table.Th>
								<Table.Th>Geschlecht</Table.Th>
								<Table.Th>Aktionen</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{teams.items.map((team) => (
								<Table.Tr key={team.id}>
									<Table.Td>{team.name}</Table.Td>
									<Table.Td>{team.slug}</Table.Td>
									<Table.Td>{team.status === "active" ? "Aktiv" : "Inaktiv"}</Table.Td>
									<Table.Td>{team.league || "-"}</Table.Td>
									<Table.Td>{team.ageGroup || "-"}</Table.Td>
									<Table.Td>{team.gender === "male" ? "Männlich" : team.gender === "female" ? "Weiblich" : team.gender === "mixed" ? "Gemischt" : "-"}</Table.Td>
									<Table.Td>
										<Group gap="xs">
											<Button size="xs" onClick={() => handleEdit(team)}>
												Bearbeiten
											</Button>
											<Button size="xs" color="red" onClick={() => handleDelete(team.id)} loading={deleteMutation.isPending}>
												Löschen
											</Button>
										</Group>
									</Table.Td>
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
				) : (
					<Text>Keine Mannschaften vorhanden</Text>
				)}
			</Paper>
		</Stack>
	);
}

export const Route = createFileRoute("/dashboard/teams")({
	component: TeamsPage,
});
