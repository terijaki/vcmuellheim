import { ActionIcon, Button, Center, Group, Modal, Paper, Stack, Table, Text, Textarea, TextInput, Title } from "@mantine/core";
import { Calendar, DateTimePicker, getTimeRange } from "@mantine/dates";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import "dayjs/locale/de";
import type { EventInput } from "@lib/db/schemas";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useTRPC } from "@/apps/shared/lib/trpc-config";

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
		variant: "",
		teamId: "",
		relatedSamsMatchId: "",
	});

	const trpc = useTRPC();
	const { data: eventsData, isLoading } = useQuery(trpc.events.list.queryOptions({ limit: 100 }));

	const events = eventsData?.items || [];
	const isMobile = useMediaQuery("(max-width: 768px)");

	// Create a set of all dates with events (excluding the one being edited)
	const eventDates = useMemo(() => {
		if (!events) return new Set<string>();

		const dates = new Set<string>();
		for (const event of events) {
			// Skip the event being edited
			if (editingId && event.id === editingId) continue;

			const start = dayjs(event.startDate);
			const end = event.endDate ? dayjs(event.endDate) : start;

			// Add all dates in the range
			let current = start;
			while (current.isBefore(end, "day") || current.isSame(end, "day")) {
				dates.add(current.format("YYYY-MM-DD"));
				current = current.add(1, "day");
			}
		}
		return dates;
	}, [events, editingId]);
	const createMutation = useMutation(
		trpc.events.create.mutationOptions({
			onSuccess: () => {
				close();
				resetForm();
			},
		}),
	);
	const updateMutation = useMutation(
		trpc.events.update.mutationOptions({
			onSuccess: () => {
				close();
				resetForm();
			},
		}),
	);
	const deleteMutation = useMutation(
		trpc.events.delete.mutationOptions({
			onSuccess: () => {},
		}),
	);

	const resetForm = () => {
		setFormData({
			title: "",
			description: "",
			startDate: null,
			endDate: null,
			location: "",
			variant: "",
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
			type: "event" as const,
			title: formData.title,
			description: formData.description || undefined,
			startDate: formData.startDate.toISOString(),
			endDate: formData.endDate ? formData.endDate.toISOString() : undefined,
			location: formData.location || undefined,
			variant: formData.variant || undefined,
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
			variant: event.variant || "",
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
					leftSection={<Plus />}
				>
					Neuer Termin
				</Button>
			</Group>

			<Center p="md">
				<Calendar
					numberOfColumns={isMobile ? 1 : 2}
					getDayProps={(date) => {
						const dateStr = dayjs(date).format("YYYY-MM-DD");
						if (eventDates.has(dateStr)) {
							return {
								style: {
									backgroundColor: "var(--mantine-color-turquoise-4)",
									border: "1px solid var(--mantine-color-turquoise-6)",
									color: "var(--mantine-color-white)",
								},
							};
						}
						return {};
					}}
				/>
			</Center>
			<Paper withBorder p="md">
				{isLoading ? (
					<Text>Laden...</Text>
				) : events.length > 0 ? (
					<Table striped highlightOnHover>
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Titel</Table.Th>
								<Table.Th>Terminart</Table.Th>
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
									<Table.Td>{event.variant || "-"}</Table.Td>
									<Table.Td>{dayjs(event.startDate).format("DD.MM.YYYY HH:mm")}</Table.Td>
									<Table.Td>{event.endDate ? dayjs(event.endDate).format("DD.MM.YYYY HH:mm") : "-"}</Table.Td>
									<Table.Td>{event.location || "-"}</Table.Td>
									<Table.Td>
										<Group gap="xs">
											<Button size="xs" onClick={() => handleEdit(event)}>
												Bearbeiten
											</Button>
											<ActionIcon variant="light" radius="xl" color="red" onClick={() => handleDelete(event.id)} loading={deleteMutation.isPending}>
												<Trash2 size={16} />
											</ActionIcon>
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

						<TextInput label="Terminart" placeholder="z.B. Spiel, Training, Versammlung" value={formData.variant} onChange={(e) => setFormData({ ...formData, variant: e.target.value })} />

						<DateTimePicker
							label="Startdatum & Uhrzeit"
							placeholder="Beginn wählen"
							value={formData.startDate}
							onChange={(date) => setFormData({ ...formData, startDate: date ? new Date(date) : null })}
							valueFormat="D MMMM YYYY - HH:mm [Uhr]"
							getDayProps={(date) => {
								const dateStr = dayjs(date).format("YYYY-MM-DD");
								if (eventDates.has(dateStr)) {
									return {
										style: {
											backgroundColor: "var(--mantine-color-turquoise-4)",
											border: "1px solid var(--mantine-color-turquoise-6)",
											color: "var(--mantine-color-white)",
										},
									};
								}
								return {};
							}}
							required
							highlightToday
							timePickerProps={{
								withDropdown: true,
								format: "24h",
								presets: getTimeRange({ startTime: "09:00:00", endTime: "14:00:00", interval: "00:30:00" }),
							}}
							presets={[
								{ value: dayjs().add(1, "day").format("YYYY-MM-DD HH:mm:ss"), label: "Morgen" },
								{ value: dayjs().add(1, "week").format("YYYY-MM-DD HH:mm:ss"), label: "Nächste Woche" },
								{ value: dayjs().add(1, "month").format("YYYY-MM-DD HH:mm:ss"), label: "Nächster Monat" },
							]}
						/>

						<DateTimePicker
							label="Enddatum & Uhrzeit"
							placeholder="Ende wählen"
							value={formData.endDate}
							onChange={(date) => setFormData({ ...formData, endDate: date ? new Date(date) : null })}
							valueFormat="D MMMM YYYY - HH:mm [Uhr]"
							getDayProps={(date) => {
								const dateStr = dayjs(date).format("YYYY-MM-DD");
								if (eventDates.has(dateStr)) {
									return {
										style: {
											backgroundColor: "var(--mantine-color-turquoise-4)",
											border: "1px solid var(--mantine-color-turquoise-6)",
											color: "var(--mantine-color-white)",
										},
									};
								}
								return {};
							}}
							clearable
							highlightToday
							timePickerProps={{
								withDropdown: true,
								format: "24h",
								presets: getTimeRange({ startTime: "16:00:00", endTime: "22:00:00", interval: "00:30:00" }),
							}}
							presets={[
								{ value: dayjs().add(1, "day").format("YYYY-MM-DD HH:mm:ss"), label: "Morgen" },
								{ value: dayjs().add(1, "week").format("YYYY-MM-DD HH:mm:ss"), label: "Nächste Woche" },
								{ value: dayjs().add(1, "month").format("YYYY-MM-DD HH:mm:ss"), label: "Nächster Monat" },
							]}
						/>

						<TextInput label="Ort" placeholder="z.B. Sporthalle Müllheim" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />

						<Textarea
							label="Beschreibung"
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
