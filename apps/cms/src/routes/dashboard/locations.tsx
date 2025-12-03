import type { LocationInput } from "@lib/db/schemas";
import { ActionIcon, Button, Card, Group, Modal, Paper, SimpleGrid, Stack, Table, Text, Textarea, TextInput, Title } from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, SquarePen, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTRPC } from "@/apps/shared/lib/trpc-config";
import { useNotification } from "../../hooks/useNotification";

function LocationsPage() {
	const isMobile = useMediaQuery("(max-width: 48em)");
	const [opened, { open, close }] = useDisclosure(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [formData, setFormData] = useState<Partial<LocationInput>>({
		name: "",
		description: "",
		street: "",
		postal: "",
		city: "",
	});

	const trpc = useTRPC();
	const notification = useNotification();
	const { data: locations, isLoading, refetch } = useQuery(trpc.locations.list.queryOptions());

	const createMutation = useMutation(
		trpc.locations.create.mutationOptions({
			onSuccess: () => {
				refetch();
				close();
				resetForm();
				notification.success("Ort wurde erfolgreich erstellt");
			},
			onError: (error: unknown) => {
				const err = error as Error;
				notification.error({
					message: err.message || "Ort konnte nicht erstellt werden",
				});
			},
		}),
	);

	const updateMutation = useMutation(
		trpc.locations.update.mutationOptions({
			onSuccess: () => {
				refetch();
				close();
				resetForm();
				notification.success("Ort wurde erfolgreich aktualisiert");
			},
			onError: (error: unknown) => {
				const err = error as Error;
				notification.error({
					message: err.message || "Ort konnte nicht aktualisiert werden",
				});
			},
		}),
	);

	const deleteMutation = useMutation(
		trpc.locations.delete.mutationOptions({
			onSuccess: () => {
				refetch();
				close();
				resetForm();
				setEditingId(null);
				notification.success("Ort wurde erfolgreich gelöscht");
			},
			onError: (error: unknown) => {
				const err = error as Error;
				notification.error({
					message: err.message || "Ort konnte nicht gelöscht werden",
				});
			},
		}),
	);

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
			notification.error({
				message: "Bitte füllen Sie alle Pflichtfelder aus",
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

	locations?.items.sort((a: LocationInput, b: LocationInput) => a.name.localeCompare(b.name));

	return (
		<Stack gap="md">
			<Group justify="space-between">
				<Title order={2}>Orte</Title>
				<Button onClick={handleOpenNew} leftSection={<Plus />} visibleFrom="sm">
					Neuer Ort
				</Button>
				<ActionIcon onClick={handleOpenNew} hiddenFrom="sm" variant="filled" radius="xl">
					<Plus size={20} />
				</ActionIcon>
			</Group>

			<Modal opened={opened} onClose={close} title={editingId ? "Ort bearbeiten" : "Neuer Ort"} size={isMobile ? "100%" : "lg"} fullScreen={isMobile}>
				<Stack gap="md" p={{ base: "md", sm: "sm" }}>
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
					<Group justify="space-between" mt="md">
						{editingId && (
							<>
								<ActionIcon hiddenFrom="sm" color="red" variant="light" onClick={() => handleDelete(editingId)} loading={deleteMutation.isPending} size="lg">
									<Trash2 />
								</ActionIcon>
								<Button visibleFrom="sm" color="red" variant="light" onClick={() => handleDelete(editingId)} loading={deleteMutation.isPending}>
									Löschen
								</Button>
							</>
						)}
						<Group gap="xs">
							<Button variant="light" onClick={close}>
								Abbrechen
							</Button>
							<Button
								variant="filled"
								onClick={handleSubmit}
								loading={createMutation.isPending || updateMutation.isPending}
								disabled={!formData.name || !formData.street || !formData.postal || !formData.city}
							>
								{editingId ? "Aktualisieren" : "Erstellen"}
							</Button>
						</Group>
					</Group>
				</Stack>
			</Modal>

			<Paper withBorder p="md">
				{isLoading ? (
					<Text>Laden...</Text>
				) : locations && locations.items.length > 0 ? (
					<>
						<Table striped highlightOnHover visibleFrom="sm">
							<Table.Thead>
								<Table.Tr>
									<Table.Th>Name</Table.Th>
									<Table.Th>Adresse</Table.Th>
									<Table.Th>Beschreibung</Table.Th>
									<Table.Th>Aktionen</Table.Th>
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{locations.items.map((location: LocationInput) => (
									<Table.Tr key={location.id}>
										<Table.Td>{location.name}</Table.Td>
										<Table.Td>
											{location.street}
											<br />
											{location.postal} {location.city}
										</Table.Td>
										<Table.Td>{location.description || "-"}</Table.Td>
										<Table.Td>
											<Button visibleFrom="sm" size="xs" onClick={() => handleEdit(location)}>
												Bearbeiten
											</Button>
											<ActionIcon hiddenFrom="sm" variant="filled" radius="xl" onClick={() => handleEdit(location)}>
												<SquarePen size={16} />
											</ActionIcon>
										</Table.Td>
									</Table.Tr>
								))}
							</Table.Tbody>
						</Table>

						<SimpleGrid cols={{ base: 1, sm: 1 }} spacing="md" hiddenFrom="sm">
							{locations.items.map((location: LocationInput) => (
								<Card key={location.id} shadow="sm" p="md" radius="md" withBorder>
									<Stack gap="xs">
										<Group justify="space-between" align="flex-start">
											<Title order={4}>{location.name}</Title>
											<ActionIcon color="blumine" variant="filled" onClick={() => handleEdit(location)} radius="xl">
												<SquarePen size={16} />
											</ActionIcon>
										</Group>
										<Stack gap="xs">
											<div>
												<Text size="xs" fw={500} c="dimmed">
													Adresse
												</Text>
												<Text size="sm">
													{location.street}
													<br />
													{location.postal} {location.city}
												</Text>
											</div>
											{location.description && (
												<div>
													<Text size="xs" fw={500} c="dimmed">
														Beschreibung
													</Text>
													<Text size="sm">{location.description}</Text>
												</div>
											)}
										</Stack>
									</Stack>
								</Card>
							))}
						</SimpleGrid>
					</>
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
