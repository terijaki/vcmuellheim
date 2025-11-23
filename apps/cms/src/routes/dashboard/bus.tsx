import { createFileRoute } from "@tanstack/react-router";
import {
	Button,
	Group,
	Modal,
	Paper,
	Stack,
	Table,
	Text,
	TextInput,
	Textarea,
	Title,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/de";
import type { BusInput } from "../../../../../lib/db/schemas";
import { trpc } from "../../lib/trpc";

dayjs.locale("de");

function BusSchedulesPage() {
	const [opened, { open, close }] = useDisclosure(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [formData, setFormData] = useState({
		driver: "",
		from: null as Date | null,
		to: null as Date | null,
		comment: "",
	});

	const utils = trpc.useUtils();
	const { data: schedules, isLoading } = trpc.bus.list.useQuery();
	const createMutation = trpc.bus.create.useMutation({
		onSuccess: () => {
			utils.bus.list.invalidate();
			close();
			resetForm();
		},
	});
	const updateMutation = trpc.bus.update.useMutation({
		onSuccess: () => {
			utils.bus.list.invalidate();
			close();
			resetForm();
		},
	});
	const deleteMutation = trpc.bus.delete.useMutation({
		onSuccess: () => {
			utils.bus.list.invalidate();
		},
	});

	const resetForm = () => {
		setFormData({ driver: "", from: null, to: null, comment: "" });
		setEditingId(null);
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		if (!formData.from || !formData.to) {
			return;
		}

		const fromISO = formData.from.toISOString();
		const toISO = formData.to.toISOString();

		if (editingId) {
			updateMutation.mutate({
				id: editingId,
				data: {
					driver: formData.driver,
					from: fromISO,
					to: toISO,
					comment: formData.comment || undefined,
				},
			});
		} else {
			createMutation.mutate({
				driver: formData.driver,
				from: fromISO,
				to: toISO,
				comment: formData.comment || undefined,
			});
		}
	};

	const handleEdit = (schedule: BusInput) => {
		setEditingId(schedule.id);
		setFormData({
			driver: schedule.driver,
			from: new Date(schedule.from),
			to: new Date(schedule.to),
			comment: schedule.comment || "",
		});
		open();
	};

	const handleDelete = (id: string) => {
		if (confirm("Möchten Sie diese Bus Buchung wirklich löschen?")) {
			deleteMutation.mutate({ id });
		}
	};

	return (
		<Stack>
			<Group justify="space-between">
				<Title order={2}>Bus Buchungen</Title>
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
				) : schedules && schedules.items.length > 0 ? (
					<Table striped highlightOnHover>
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Fahrer</Table.Th>
								<Table.Th>Von</Table.Th>
								<Table.Th>Bis</Table.Th>
								<Table.Th>Kommentar</Table.Th>
								<Table.Th>Aktionen</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{schedules.items.map((schedule) => (
								<Table.Tr key={schedule.id}>
									<Table.Td>{schedule.driver}</Table.Td>
									<Table.Td>{dayjs(schedule.from).format("DD.MM.YYYY HH:mm")}</Table.Td>
									<Table.Td>{dayjs(schedule.to).format("DD.MM.YYYY HH:mm")}</Table.Td>
									<Table.Td>{schedule.comment || "-"}</Table.Td>
									<Table.Td>
										<Group gap="xs">
											<Button size="xs" onClick={() => handleEdit(schedule)}>
												Bearbeiten
											</Button>
											<Button
												size="xs"
												color="red"
												onClick={() => handleDelete(schedule.id)}
												loading={deleteMutation.isPending}
											>
												Löschen
											</Button>
										</Group>
									</Table.Td>
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
				) : (
					<Text c="dimmed">Noch keine Bus Buchungen vorhanden. Erstellen Sie einen neuen Eintrag.</Text>
				)}
			</Paper>

			<Modal
				opened={opened}
				onClose={() => {
					close();
					resetForm();
				}}
				title={editingId ? "Bus Buchung bearbeiten" : "Bus Buchung hinzufügen"}
			>
				<form onSubmit={handleSubmit}>
					<Stack>
						<TextInput
							label="Fahrer"
							placeholder="z.B. Max Mustermann"
							value={formData.driver}
							onChange={(e) => setFormData({ ...formData, driver: e.target.value })}
							required
						/>
					<DateTimePicker
						label="Von (Datum & Uhrzeit)"
						placeholder="Abfahrt wählen"
						value={formData.from}
						onChange={(date) => setFormData({ ...formData, from: date ? new Date(date) : null })}
						required
					/>
					<DateTimePicker
						label="Bis (Datum & Uhrzeit)"
						placeholder="Rückkehr wählen"
						value={formData.to}
						onChange={(date) => setFormData({ ...formData, to: date ? new Date(date) : null })}
						required
					/>
						<Textarea
							label="Kommentar"
							placeholder="Zusätzliche Informationen..."
							value={formData.comment}
							onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
							minRows={3}
						/>
						<Group justify="flex-end" mt="md">
							<Button variant="subtle" onClick={close}>
								Abbrechen
							</Button>
							<Button
								type="submit"
								loading={createMutation.isPending || updateMutation.isPending}
							>
								{editingId ? "Aktualisieren" : "Erstellen"}
							</Button>
						</Group>
					</Stack>
				</form>
			</Modal>
		</Stack>
	);
}

export const Route = createFileRoute("/dashboard/bus")({
	component: BusSchedulesPage,
});
