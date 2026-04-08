import { ActionIcon, Button, Card, Center, Group, Modal, SegmentedControl, SimpleGrid, Stack, Table, Text, Textarea, TextInput, Title } from "@mantine/core";
import { Calendar, DatePickerInput } from "@mantine/dates";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { useForm } from "@tanstack/react-form-start";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import "dayjs/locale/de";
import type { BusInput } from "@lib/db/schemas";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNotification } from "@webapp/hooks/useNotification";
import { createBusFn, deleteBusFn, listBusFn, updateBusFn } from "@webapp/server/functions/bus";
import { Plus, SquarePen, Trash2 } from "lucide-react";

dayjs.locale("de");

const defaultFormValues = {
	id: undefined as string | undefined,
	driver: "",
	dateRange: [null, null] as [Date | null, Date | null],
	comment: "",
};

function BusSchedulesPage() {
	const notification = useNotification();
	const [opened, { open, close }] = useDisclosure(false);
	const [timeFilter, setTimeFilter] = useState<"upcoming" | "past">("upcoming");

	const form = useForm({
		defaultValues: defaultFormValues,
		onSubmit: async ({ value }) => {
			const [from, to] = value.dateRange;
			if (!from || !to) {
				return;
			}

			const fromISO = from.toISOString();
			const toISO = to.toISOString();
			const currentEditingId = value.id;

			if (currentEditingId) {
				updateMutation.mutate({
					id: currentEditingId,
					data: {
						driver: value.driver,
						from: fromISO,
						to: toISO,
						comment: value.comment || undefined,
					},
				});
			} else {
				createMutation.mutate({
					driver: value.driver,
					from: fromISO,
					to: toISO,
					comment: value.comment || undefined,
				});
			}
		},
	});

	const { data: schedules, isLoading, refetch } = useQuery({ queryKey: ["bus", "list"], queryFn: () => listBusFn() });
	const isMobile = useMediaQuery("(max-width: 768px)");
	const editingId = form.getFieldValue("id");

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

	const createMutation = useMutation({
		mutationFn: (data: Parameters<typeof createBusFn>[0]["data"]) => createBusFn({ data }),
		onSuccess: () => {
			refetch();
			close();
			resetForm();
			notification.success("Fahrt wurde erfolgreich erstellt");
		},
		onError: () => {
			notification.error({ message: "Fahrt konnte nicht erstellt werden" });
		},
	});

	const updateMutation = useMutation({
		mutationFn: (data: Parameters<typeof updateBusFn>[0]["data"]) => updateBusFn({ data }),
		onSuccess: () => {
			refetch();
			close();
			resetForm();
			notification.success("Fahrt wurde erfolgreich aktualisiert");
		},
		onError: () => {
			notification.error({ message: "Fahrt konnte nicht aktualisiert werden" });
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (data: Parameters<typeof deleteBusFn>[0]["data"]) => deleteBusFn({ data }),
		onSuccess: () => {
			refetch();
			close();
			resetForm();
			notification.success("Fahrt wurde erfolgreich gelöscht");
		},
		onError: () => {
			notification.error({ message: "Fahrt konnte nicht gelöscht werden" });
		},
	});

	const resetForm = () => {
		form.reset();
	};

	const handleEdit = (schedule: BusInput) => {
		form.setFieldValue("id", schedule.id);
		form.setFieldValue("driver", schedule.driver);
		form.setFieldValue("dateRange", [new Date(schedule.from), new Date(schedule.to)]);
		form.setFieldValue("comment", schedule.comment || "");
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
				<Card>
					<Calendar
						numberOfColumns={isMobile ? 1 : 2}
						getDayProps={(date) => {
							const dateStr = dayjs(date).format("YYYY-MM-DD");
							if (bookedDates.has(dateStr)) {
								return {
									style: {
										backgroundColor: "var(--mantine-color-turquoise-6)",
										border: "1px solid var(--mantine-color-turquoise-8)",
										color: "var(--mantine-color-white)",
									},
								};
							}
							return {};
						}}
					/>
				</Card>
			</Center>

			<SegmentedControl
				value={timeFilter}
				onChange={(value) => setTimeFilter(value as typeof timeFilter)}
				data={[
					{ label: "Bevorstehend", value: "upcoming" },
					{ label: "Vergangene", value: "past" },
				]}
			/>

			{isLoading ? (
				<Text>Laden...</Text>
			) : filteredSchedules.length > 0 ? (
				<>
					<Card withBorder bg="white" p={0} radius="md" visibleFrom="sm">
						<Table striped highlightOnHover horizontalSpacing="md">
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
					</Card>

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
				</>
			) : (
				<Text c="dimmed" ta="center" py="xl">
					{timeFilter === "upcoming" ? "Keine bevorstehenden Buchungen" : "Keine vergangenen Buchungen"}
				</Text>
			)}

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
				<form
					onSubmit={(e) => {
						e.preventDefault();
						void form.handleSubmit();
					}}
				>
					<form.Subscribe selector={(state) => state.values}>
						{(formData) => (
							<Stack>
								<form.Field name="driver">
									{(field) => <TextInput label="Fahrer" placeholder="z.B. Max Mustermann" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} required />}
								</form.Field>
								<form.Field name="dateRange">
									{(field) => (
										<DatePickerInput
											type="range"
											locale="de"
											allowSingleDateInRange
											label="Zeitraum"
											placeholder="Von - Bis auswählen"
											value={field.state.value}
											onChange={(value) => {
												const [start, end] = value || [null, null];
												field.handleChange([start ? new Date(start) : null, end ? new Date(end) : null]);
											}}
											getDayProps={(date) => {
												const dateStr = dayjs(date).format("YYYY-MM-DD");
												if (bookedDates.has(dateStr)) {
													return {
														style: {
															backgroundColor: "var(--mantine-color-turquoise-6)",
															border: "1px solid var(--mantine-color-turquoise-8)",
															color: "var(--mantine-color-white)",
														},
													};
												}
												return {};
											}}
											valueFormat="D MMM YYYY"
											required
											presets={
												isMobile
													? undefined
													: [
															{ value: [dayjs().add(1, "day").format("YYYY-MM-DD"), dayjs().add(1, "day").format("YYYY-MM-DD")], label: "Morgen" },
															{
																value: [dayjs().endOf("week").subtract(1, "day").add(1, "week").format("YYYY-MM-DD"), dayjs().endOf("week").subtract(1, "day").add(1, "week").format("YYYY-MM-DD")],
																label: "Nächsten Samstag",
															},
															{
																value: [dayjs().endOf("week").subtract(1, "day").add(1, "week").format("YYYY-MM-DD"), dayjs().endOf("week").add(1, "week").format("YYYY-MM-DD")],
																label: "Nächstes Wochenende",
															},
															{ value: [dayjs().endOf("month").add(1, "day").format("YYYY-MM-DD"), dayjs().endOf("month").add(1, "day").format("YYYY-MM-DD")], label: "Nächster Monat" },
														]
											}
										/>
									)}
								</form.Field>
								<form.Field name="comment">
									{(field) => <Textarea label="Kommentar" placeholder="Zusätzliche Informationen..." value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} minRows={3} />}
								</form.Field>
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
										<Button variant="light" type="button" onClick={close}>
											Abbrechen
										</Button>
										<Button
											variant="filled"
											type="submit"
											loading={createMutation.isPending || updateMutation.isPending}
											disabled={!formData.driver || !formData.dateRange[0] || !formData.dateRange[1]}
										>
											{editingId ? "Aktualisieren" : "Erstellen"}
										</Button>
									</Group>
								</Group>
							</Stack>
						)}
					</form.Subscribe>
				</form>
			</Modal>
		</Stack>
	);
}

export const Route = createFileRoute("/admin/_layout/bus")({
	component: BusSchedulesPage,
});
