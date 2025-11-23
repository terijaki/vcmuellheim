import type { SponsorInput } from "@lib/db/schemas";
import { Button, Group, Modal, Paper, Stack, Table, Text, Textarea, TextInput, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "../../lib/trpc";

function SponsorsPage() {
	const [opened, { open, close }] = useDisclosure(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [formData, setFormData] = useState<Partial<SponsorInput>>({
		name: "",
		description: "",
		websiteUrl: "",
	});

	const { data: sponsors, isLoading, refetch } = trpc.sponsors.list.useQuery();
	const createMutation = trpc.sponsors.create.useMutation({
		onSuccess: () => {
			refetch();
			close();
			resetForm();
			notifications.show({
				title: "Erfolg",
				message: "Sponsor wurde erfolgreich erstellt",
				color: "green",
			});
		},
		onError: (error) => {
			notifications.show({
				title: "Fehler",
				message: error.message || "Sponsor konnte nicht erstellt werden",
				color: "red",
			});
		},
	});
	const updateMutation = trpc.sponsors.update.useMutation({
		onSuccess: () => {
			refetch();
			close();
			resetForm();
			notifications.show({
				message: "Sponsoränderung wurde gespeichert",
				color: "green",
			});
		},
		onError: (error) => {
			notifications.show({
				title: "Fehler",
				message: error.message || "Sponsor konnte nicht aktualisiert werden",
				color: "red",
			});
		},
	});
	const deleteMutation = trpc.sponsors.delete.useMutation({
		onSuccess: () => {
			refetch();
			notifications.show({
				title: "Erfolg",
				message: "Sponsor wurde erfolgreich gelöscht",
				color: "green",
			});
		},
		onError: (error) => {
			notifications.show({
				title: "Fehler",
				message: error.message || "Sponsor konnte nicht gelöscht werden",
				color: "red",
			});
		},
	});

	const resetForm = () => {
		setFormData({
			name: "",
			description: "",
			websiteUrl: "",
		});
		setEditingId(null);
	};

	const handleSubmit = () => {
		if (!formData.name) return;

		// Filter out empty strings to avoid DynamoDB GSI errors
		const cleanedData = Object.fromEntries(Object.entries(formData).filter(([_, value]) => value !== "" && value !== undefined));

		if (editingId) {
			updateMutation.mutate({
				id: editingId,
				data: cleanedData,
			});
		} else {
			createMutation.mutate(cleanedData as SponsorInput);
		}
	};

	const handleEdit = (sponsor: SponsorInput & { id: string }) => {
		setFormData({
			name: sponsor.name,
			description: sponsor.description || "",
			websiteUrl: sponsor.websiteUrl || "",
		});
		setEditingId(sponsor.id);
		open();
	};

	const handleDelete = (id: string) => {
		if (window.confirm("Möchten Sie diesen Sponsor wirklich löschen?")) {
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
				<Title order={2}>Sponsoren</Title>
				<Button onClick={handleOpenNew}>Neuer Sponsor</Button>
			</Group>

			<Modal opened={opened} onClose={close} title={editingId ? "Sponsor bearbeiten" : "Neuer Sponsor"} size="lg">
				<Stack gap="md">
					<TextInput label="Name" placeholder="z.B. Firma Mustermann" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />

					<Textarea label="Beschreibung" placeholder="Optionale Beschreibung..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} minRows={3} />

					<TextInput label="Website" placeholder="https://..." value={formData.websiteUrl} onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })} />

					{/* TODO: Add logo upload functionality */}

					<Group justify="flex-end" mt="md">
						<Button variant="subtle" onClick={close}>
							Abbrechen
						</Button>
						<Button onClick={handleSubmit} loading={createMutation.isPending || updateMutation.isPending} disabled={!formData.name}>
							{editingId ? "Aktualisieren" : "Erstellen"}
						</Button>
					</Group>
				</Stack>
			</Modal>

			<Paper withBorder p="md">
				{isLoading ? (
					<Text>Laden...</Text>
				) : sponsors && sponsors.items.length > 0 ? (
					<Table striped highlightOnHover>
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Name</Table.Th>
								<Table.Th>Website</Table.Th>
								<Table.Th>Logo</Table.Th>
								<Table.Th>Aktionen</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{sponsors.items.map((sponsor) => (
								<Table.Tr key={sponsor.id}>
									<Table.Td>{sponsor.name}</Table.Td>
									<Table.Td>
										{sponsor.websiteUrl ? (
											<a href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer">
												Link
											</a>
										) : (
											"-"
										)}
									</Table.Td>
									<Table.Td>{sponsor.logoId ? "✓" : "-"}</Table.Td>
									<Table.Td>
										<Group gap="xs">
											<Button size="xs" onClick={() => handleEdit(sponsor)}>
												Bearbeiten
											</Button>
											<Button size="xs" color="red" onClick={() => handleDelete(sponsor.id)} loading={deleteMutation.isPending}>
												Löschen
											</Button>
										</Group>
									</Table.Td>
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
				) : (
					<Text>Keine Sponsoren vorhanden</Text>
				)}
			</Paper>
		</Stack>
	);
}

export const Route = createFileRoute("/dashboard/sponsors")({
	component: SponsorsPage,
});
