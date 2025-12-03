import { ActionIcon, Button, Card, Center, Group, Modal, Paper, SegmentedControl, SimpleGrid, Stack, Table, Text, Textarea, TextInput, Title } from "@mantine/core";
import { Calendar, DatePickerInput } from "@mantine/dates";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import "dayjs/locale/de";
import type { BusInput } from "@lib/db/schemas";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, SquarePen, Trash2 } from "lucide-react";
import { useTRPC } from "@/apps/shared/lib/trpc-config";
import { useNotification } from "../../hooks/useNotification";

dayjs.locale("de");

function BusSchedulesPage() {
	const notification = useNotification();
	const [opened, { open, close }] = useDisclosure(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [timeFilter, setTimeFilter] = useState<"upcoming" | "past">("upcoming");
	const [formData, setFormData] = useState({
		driver: "",
		dateRange: [null, null] as [Date | null, Date | null],
		comment: "",
	});

	const trpc = useTRPC();
	const { data: schedules, isLoading, refetch } = useQuery(trpc.bus.list.queryOptions());
	const isMobile = useMediaQuery("(max-width: 768px)");

	// Create a set of all booked dates (excluding the one being edited)
	const bookedDates = useMemo(() => {
		if (!schedules?.items) return new Set<string>();

		const dates = new Set<string>();
		for (const schedule of schedules.items) {
			// Skip the schedule being edited
			if (editingId && schedule.id === editingId) continue;

			const start = dayjs(schedule.from);
			const end = dayjs(schedule.to);

			// Add all dates in the range
			let current = start;
			while (current.isBefore(end) || current.isSame(end, "day")) {
				dates.add(current.format("YYYY-MM-DD"));
				current = current.add(1, "day");
			}
		}
		return dates;
	}, [schedules, editingId]);

	const createMutation = useMutation(
		trpc.bus.create.mutationOptions({
			onSuccess: () => {
				refetch();
				close();
				resetForm();
				notification.success("Fahrt wurde erfolgreich erstellt");
			},
			onError: () => {
				notification.error({ message: "Fahrt konnte nicht erstellt werden" });
			},
		}),
	);

	const updateMutation = useMutation(
		trpc.bus.update.mutationOptions({
			onSuccess: () => {
				refetch();
				close();
				resetForm();
				notification.success("Fahrt wurde erfolgreich aktualisiert");
			},
			onError: () => {
				notification.error({ message: "Fahrt konnte nicht aktualisiert werden" });
			},
		}),
	);

	const deleteMutation = useMutation(
		trpc.bus.delete.mutationOptions({
			onSuccess: () => {
				refetch();
				close();
				resetForm();
				setEditingId(null);
				notification.success("Fahrt wurde erfolgreich gelöscht");
			},
			onError: () => {
				notification.error({ message: "Fahrt konnte nicht gelöscht werden" });
			},
		}),
	);

	const resetForm = () => {
		setFormData({ driver: "", dateRange: [null, null], comment: "" });
		setEditingId(null);
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		const [from, to] = formData.dateRange;
		if (!from || !to) {
			return;
		}

		const fromISO = from.toISOString();
		const toISO = to.toISOString();

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
			dateRange: [new Date(schedule.from), new Date(schedule.to)],
			comment: schedule.comment || "",
		});
		open();
	};

	const handleDelete = (id: string) => {
		if (confirm("Möchten Sie diese Bus Buchung wirklich löschen?")) {
			deleteMutation.mutate({ id });
		}
	};

	// Filter bookings based on time filter
	const filteredSchedules = useMemo(() => {
		if (!schedules?.items) return [];

		const now = dayjs();
		const filtered = schedules.items.filter((schedule) => {
			const scheduleEnd = dayjs(schedule.to);
			if (timeFilter === "upcoming") {
				return scheduleEnd.isAfter(now) || scheduleEnd.isSame(now, "day");
			}
			return scheduleEnd.isBefore(now);
		});

		// Sort: upcoming by start date ascending, past by start date descending
		return filtered.sort((a, b) => {
			const comparison = dayjs(a.from).unix() - dayjs(b.from).unix();
			return timeFilter === "upcoming" ? comparison : -comparison;
		});
	}, [schedules?.items, timeFilter]);

	return (
		<Stack>
			<Group justify="space-between">
				<Title order={2}>Bus Buchungen</Title>
				<Button
					onClick={() => {
						resetForm();
						open();
					}}
					leftSection={<Plus />}
					visibleFrom="sm"
				>
					Neue Buchung
				</Button>
				<ActionIcon
					onClick={() => {
						resetForm();
						open();
					}}
					hiddenFrom="sm"
					variant="filled"
					radius="xl"
				>
					<Plus size={20} />
				</ActionIcon>
			</Group>

			<Center pb="md">
				<Calendar
					numberOfColumns={isMobile ? 1 : 2}
					getDayProps={(date) => {
						const dateStr = dayjs(date).format("YYYY-MM-DD");
						if (bookedDates.has(dateStr)) {
							return {
								style: {
									backgroundColor: "var(--mantine-color-turquoise-2)",
									border: "1px solid var(--mantine-color-turquoise-6)",
									color: "var(--mantine-color-white)",
								},
							};
						}
						return {};
					}}
				/>
			</Center>

			<SegmentedControl
				value={timeFilter}
				onChange={(value) => setTimeFilter(value as typeof timeFilter)}
				data={[
					{ label: "Bevorstehend", value: "upcoming" },
					{ label: "Vergangene", value: "past" },
				]}
			/>

			<Paper withBorder p="md">
				{isLoading ? (
					<Text>Laden...</Text>
				) : filteredSchedules.length > 0 ? (
					<>
						<Table striped highlightOnHover visibleFrom="sm">
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
								{filteredSchedules.map((schedule) => (
									<Table.Tr key={schedule.id}>
										<Table.Td>{schedule.driver}</Table.Td>
										<Table.Td>{dayjs(schedule.from).format("DD.MM.YYYY")}</Table.Td>
										<Table.Td>{dayjs(schedule.to).format("DD.MM.YYYY")}</Table.Td>
										<Table.Td>{schedule.comment || "-"}</Table.Td>
										<Table.Td>
											<Button visibleFrom="sm" size="xs" onClick={() => handleEdit(schedule)}>
												Bearbeiten
											</Button>
											<ActionIcon hiddenFrom="sm" variant="filled" radius="xl" onClick={() => handleEdit(schedule)}>
												<SquarePen size={16} />
											</ActionIcon>
										</Table.Td>
									</Table.Tr>
								))}
							</Table.Tbody>
						</Table>

						<SimpleGrid cols={{ base: 1, sm: 1 }} spacing="md" hiddenFrom="sm">
							{filteredSchedules.map((schedule) => (
								<Card key={schedule.id} shadow="sm" p="md" radius="md" withBorder>
									<Stack gap="xs">
										<Group justify="space-between" align="flex-start">
											<Title order={4}>{schedule.driver}</Title>
											<ActionIcon color="blumine" variant="filled" onClick={() => handleEdit(schedule)} radius="xl">
												<SquarePen size={16} />
											</ActionIcon>
										</Group>
										<Stack gap="xs">
											<div>
												<Text size="xs" fw={500} c="dimmed">
													Zeitraum
												</Text>
												<Text size="sm">
													{dayjs(schedule.from).isSame(dayjs(schedule.to), "day")
														? dayjs(schedule.from).format("DD.MM.YYYY")
														: `${dayjs(schedule.from).format("DD.MM.YYYY")} - ${dayjs(schedule.to).format("DD.MM.YYYY")}`}
												</Text>
											</div>
											{schedule.comment && (
												<div>
													<Text size="xs" fw={500} c="dimmed">
														Kommentar
													</Text>
													<Text size="sm">{schedule.comment}</Text>
												</div>
											)}
										</Stack>
									</Stack>
								</Card>
							))}
						</SimpleGrid>

						<Text size="sm" c="dimmed" mt="md">
							{filteredSchedules.length} {timeFilter === "upcoming" ? "bevorstehende" : "vergangene"} Buchung{filteredSchedules.length !== 1 ? "en" : ""}
						</Text>
					</>
				) : (
					<Text c="dimmed" ta="center" py="xl">
						{timeFilter === "upcoming" ? "Keine bevorstehenden Buchungen" : "Keine vergangenen Buchungen"}
					</Text>
				)}
			</Paper>

			<Modal
				opened={opened}
				onClose={() => {
					close();
					resetForm();
				}}
				title={editingId ? "Bus Buchung bearbeiten" : "Bus Buchung hinzufügen"}
				size={isMobile ? "100%" : "lg"}
				fullScreen={isMobile}
			>
				<form onSubmit={handleSubmit}>
					<Stack>
						<TextInput label="Fahrer" placeholder="z.B. Max Mustermann" value={formData.driver} onChange={(e) => setFormData({ ...formData, driver: e.target.value })} required />
						<DatePickerInput
							type="range"
							allowSingleDateInRange
							label="Zeitraum"
							placeholder="Von - Bis auswählen"
							value={formData.dateRange}
							onChange={(value) => {
								const [start, end] = value || [null, null];
								setFormData({
									...formData,
									dateRange: [start ? new Date(start) : null, end ? new Date(end) : null],
								});
							}}
							getDayProps={(date) => {
								const dateStr = dayjs(date).format("YYYY-MM-DD");
								if (bookedDates.has(dateStr)) {
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
							valueFormat="D MMM YYYY"
							required
							presets={[
								{ value: [dayjs().add(1, "day").format("YYYY-MM-DD"), dayjs().add(1, "day").format("YYYY-MM-DD")], label: "Morgen" },
								{
									value: [dayjs().endOf("week").subtract(1, "day").add(1, "week").format("YYYY-MM-DD"), dayjs().endOf("week").subtract(1, "day").add(1, "week").format("YYYY-MM-DD")],
									label: "Nächsten Samstag",
								},
								{ value: [dayjs().endOf("week").subtract(1, "day").add(1, "week").format("YYYY-MM-DD"), dayjs().endOf("week").add(1, "week").format("YYYY-MM-DD")], label: "Nächstes Wochenende" },
								{ value: [dayjs().endOf("month").add(1, "day").format("YYYY-MM-DD"), dayjs().endOf("month").add(1, "day").format("YYYY-MM-DD")], label: "Nächster Monat" },
							]}
						/>
						<Textarea label="Kommentar" placeholder="Zusätzliche Informationen..." value={formData.comment} onChange={(e) => setFormData({ ...formData, comment: e.target.value })} minRows={3} />
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
								<Button variant="filled" type="submit" loading={createMutation.isPending || updateMutation.isPending}>
									{editingId ? "Aktualisieren" : "Erstellen"}
								</Button>
							</Group>
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
