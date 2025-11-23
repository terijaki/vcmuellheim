import { Button, Group, Modal, Paper, Stack, Table, Text, Textarea, TextInput, Title } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useState } from "react";
import "dayjs/locale/de";
import type { EventInput } from "../../../../../lib/db/schemas";
import { trpc } from "../../lib/trpc";

dayjs.locale("de");

function EventsPage() {
	const [opened, { open, close }] = useDisclosure(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [formData, setFormData] = useState({
		title: "",
		description: "",
		startDate: null as Date | null,
		endDate: null as Date | null,
		location: "",
		type: "",
		teamId: "",
		relatedSamsMatchId: "",
	});

	const utils = trpc.useUtils();
	const { data: eventsData, isLoading } = trpc.events.list.useQuery({ limit: 100 });
	const events = eventsData?.items || [];
	const createMutation = trpc.events.create.useMutation({
		onSuccess: () => {
			utils.events.list.invalidate();
			close();
			resetForm();
		},
	});
	const updateMutation = trpc.events.update.useMutation({
		onSuccess: () => {
			utils.events.list.invalidate();
			close();
			resetForm();
		},
	});
	const deleteMutation = trpc.events.delete.useMutation({
		onSuccess: () => {
			utils.events.list.invalidate();
		},
	});

	const resetForm = () => {
		setFormData({
			title: "",
			description: "",
			startDate: null,
			endDate: null,
			location: "",
			type: "",
			teamId: "",
			relatedSamsMatchId: "",
		});
		setEditingId(null);
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		if (!formData.startDate) {
			return;
		}

		const data = {
			title: formData.title,
			description: formData.description || undefined,
			startDate: formData.startDate.toISOString(),
			endDate: formData.endDate ? formData.endDate.toISOString() : undefined,
			location: formData.location || undefined,
			type: formData.type || undefined,
			teamId: formData.teamId || undefined,
			relatedSamsMatchId: formData.relatedSamsMatchId || undefined,
		};

		if (editingId) {
			updateMutation.mutate({ id: editingId, data });
		} else {
			createMutation.mutate(data);
		}
	};

	const handleEdit = (event: EventInput) => {
		setEditingId(event.id);
		setFormData({
			title: event.title,
			description: event.description || "",
			startDate: new Date(event.startDate),
			endDate: event.endDate ? new Date(event.endDate) : null,
			location: event.location || "",
			type: event.type || "",
			teamId: event.teamId || "",
			relatedSamsMatchId: event.relatedSamsMatchId || "",
		});
		open();
	};

	const handleDelete = (id: string) => {
		if (confirm("Möchten Sie diesen Termin wirklich löschen?")) {
			deleteMutation.mutate({ id });
		}
	};

	return (
		<Stack>
			<Group justify="space-between">
				<Title order={2}>Termine</Title>
				<Button
					onClick={() => {
						resetForm();
						open();
					}}
				>
					Hinzufügen
				</Button>
			</Group>

			<Paper withBorder p="md">
				{isLoading ? (
					<Text>Laden...</Text>
				) : events.length > 0 ? (
					<Table striped highlightOnHover>
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Titel</Table.Th>
								<Table.Th>Typ</Table.Th>
								<Table.Th>Start</Table.Th>
								<Table.Th>Ende</Table.Th>
								<Table.Th>Ort</Table.Th>
								<Table.Th>Aktionen</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{events.map((event) => (
								<Table.Tr key={event.id}>
									<Table.Td>{event.title}</Table.Td>
									<Table.Td>{event.type || "-"}</Table.Td>
									<Table.Td>{dayjs(event.startDate).format("DD.MM.YYYY HH:mm")}</Table.Td>
									<Table.Td>{event.endDate ? dayjs(event.endDate).format("DD.MM.YYYY HH:mm") : "-"}</Table.Td>
									<Table.Td>{event.location || "-"}</Table.Td>
									<Table.Td>
										<Group gap="xs">
											<Button size="xs" onClick={() => handleEdit(event)}>
												Bearbeiten
											</Button>
											<Button size="xs" color="red" onClick={() => handleDelete(event.id)} loading={deleteMutation.isPending}>
												Löschen
											</Button>
										</Group>
									</Table.Td>
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
				) : (
					<Text c="dimmed">Noch keine Termine vorhanden. Erstellen Sie einen neuen Eintrag.</Text>
				)}
			</Paper>

			<Modal
				opened={opened}
				onClose={() => {
					close();
					resetForm();
				}}
				title={editingId ? "Termin bearbeiten" : "Termin hinzufügen"}
				size="lg"
			>
				<form onSubmit={handleSubmit}>
					<Stack>
						<TextInput label="Titel" placeholder="z.B. Heimspiel gegen Team X" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />

						<TextInput label="Typ (optional)" placeholder="z.B. Spiel, Training, Versammlung" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} />

						<DateTimePicker
							label="Startdatum & Uhrzeit"
							placeholder="Beginn wählen"
							value={formData.startDate}
							onChange={(date) => setFormData({ ...formData, startDate: date ? new Date(date) : null })}
							valueFormat="D MMMM YYYY - HH:mm [Uhr]"
							required
						/>

						<DateTimePicker
							label="Enddatum & Uhrzeit (optional)"
							placeholder="Ende wählen"
							value={formData.endDate}
							onChange={(date) => setFormData({ ...formData, endDate: date ? new Date(date) : null })}
							valueFormat="D MMMM YYYY - HH:mm [Uhr]"
						/>

						<TextInput label="Ort (optional)" placeholder="z.B. Sporthalle Müllheim" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />

						<Textarea
							label="Beschreibung (optional)"
							placeholder="Zusätzliche Informationen..."
							value={formData.description}
							onChange={(e) => setFormData({ ...formData, description: e.target.value })}
							minRows={3}
						/>

						<Group justify="flex-end" mt="md">
							<Button variant="subtle" onClick={close}>
								Abbrechen
							</Button>
							<Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
								{editingId ? "Aktualisieren" : "Erstellen"}
							</Button>
						</Group>
					</Stack>
				</form>
			</Modal>
		</Stack>
	);
}

export const Route = createFileRoute("/dashboard/events")({
	component: EventsPage,
});
