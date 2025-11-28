import type { LocationInput } from "@lib/db/schemas";
import { ActionIcon, Button, Group, Modal, Paper, Stack, Table, Text, Textarea, TextInput, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { trpc } from "../../lib/trpc";

function LocationsPage() {
	const [opened, { open, close }] = useDisclosure(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [formData, setFormData] = useState<Partial<LocationInput>>({
		name: "",
		description: "",
		street: "",
		postal: "",
		city: "",
	});

	const { data: locations, isLoading, refetch } = trpc.locations.list.useQuery();

	const createMutation = trpc.locations.create.useMutation({
		onSuccess: () => {
			refetch();
			close();
			resetForm();
			notifications.show({
				title: "Erfolg",
				message: "Ort wurde erfolgreich erstellt",
				color: "green",
			});
		},
		onError: (error) => {
			notifications.show({
				title: "Fehler",
				message: error.message || "Ort konnte nicht erstellt werden",
				color: "red",
			});
		},
	});

	const updateMutation = trpc.locations.update.useMutation({
		onSuccess: () => {
			refetch();
			close();
			resetForm();
			notifications.show({
				title: "Erfolg",
				message: "Ort wurde erfolgreich aktualisiert",
				color: "green",
			});
		},
		onError: (error) => {
			notifications.show({
				title: "Fehler",
				message: error.message || "Ort konnte nicht aktualisiert werden",
				color: "red",
			});
		},
	});

	const deleteMutation = trpc.locations.delete.useMutation({
		onSuccess: () => {
			refetch();
			notifications.show({
				title: "Erfolg",
				message: "Ort wurde erfolgreich gelöscht",
				color: "green",
			});
		},
		onError: (error) => {
			notifications.show({
				title: "Fehler",
				message: error.message || "Ort konnte nicht gelöscht werden",
				color: "red",
			});
		},
	});

	const resetForm = () => {
		setFormData({
			name: "",
			description: "",
			street: "",
			postal: "",
			city: "",
		});
		setEditingId(null);
	};

	const handleSubmit = () => {
		if (!formData.name || !formData.street || !formData.postal || !formData.city) {
			notifications.show({
				title: "Fehler",
				message: "Bitte füllen Sie alle Pflichtfelder aus",
				color: "red",
			});
			return;
		}

		if (editingId) {
			updateMutation.mutate({
				id: editingId,
				data: formData,
			});
		} else {
			createMutation.mutate(formData as Omit<LocationInput, "id" | "createdAt" | "updatedAt">);
		}
	};

	const handleEdit = (location: LocationInput) => {
		setFormData({
			name: location.name,
			description: location.description,
			street: location.street,
			postal: location.postal,
			city: location.city,
		});
		setEditingId(location.id);
		open();
	};

	const handleDelete = (id: string) => {
		if (window.confirm("Möchten Sie diesen Ort wirklich löschen?")) {
			deleteMutation.mutate({ id });
		}
	};

	const handleOpenNew = () => {
		resetForm();
		open();
	};

	locations?.items.sort((a, b) => a.name.localeCompare(b.name));

	return (
		<Stack gap="md">
			<Group justify="space-between">
				<Title order={2}>Orte</Title>
				<Button onClick={handleOpenNew} leftSection={<Plus />}>
					Neuer Ort
				</Button>
			</Group>

			<Modal opened={opened} onClose={close} title={editingId ? "Ort bearbeiten" : "Neuer Ort"} size="lg">
				<Stack gap="md">
					<TextInput label="Name" placeholder="z.B. Sporthalle Müllheim" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
					<Textarea
						label="Beschreibung"
						placeholder="Optional: Zusätzliche Informationen zum Ort"
						value={formData.description}
						onChange={(e) => setFormData({ ...formData, description: e.target.value })}
						minRows={3}
					/>
					<TextInput label="Straße" placeholder="z.B. Sportplatzweg 1" value={formData.street} onChange={(e) => setFormData({ ...formData, street: e.target.value })} required />
					<Group grow>
						<TextInput label="PLZ" placeholder="z.B. 79379" value={formData.postal} onChange={(e) => setFormData({ ...formData, postal: e.target.value })} required />
						<TextInput label="Stadt" placeholder="z.B. Müllheim" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} required />
					</Group>
					<Group justify="flex-end" mt="md">
						<Button variant="subtle" onClick={close}>
							Abbrechen
						</Button>
						<Button onClick={handleSubmit} loading={createMutation.isPending || updateMutation.isPending} disabled={!formData.name || !formData.street || !formData.postal || !formData.city}>
							{editingId ? "Aktualisieren" : "Erstellen"}
						</Button>
					</Group>
				</Stack>
			</Modal>

			<Paper withBorder p="md">
				{isLoading ? (
					<Text>Laden...</Text>
				) : locations && locations.items.length > 0 ? (
					<Table striped highlightOnHover>
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Name</Table.Th>
								<Table.Th>Adresse</Table.Th>
								<Table.Th>Beschreibung</Table.Th>
								<Table.Th>Aktionen</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{locations.items.map((location) => (
								<Table.Tr key={location.id}>
									<Table.Td>{location.name}</Table.Td>
									<Table.Td>
										{location.street}
										<br />
										{location.postal} {location.city}
									</Table.Td>
									<Table.Td>{location.description || "-"}</Table.Td>
									<Table.Td>
										<Group gap="xs">
											<Button size="xs" onClick={() => handleEdit(location)}>
												Bearbeiten
											</Button>
											<ActionIcon variant="light" radius="xl" color="red" onClick={() => handleDelete(location.id)} loading={deleteMutation.isPending}>
												<Trash2 size={16} />
											</ActionIcon>
										</Group>
									</Table.Td>
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
				) : (
					<Text>Keine Orte vorhanden</Text>
				)}
			</Paper>
		</Stack>
	);
}

export const Route = createFileRoute("/dashboard/locations")({
	component: LocationsPage,
});
