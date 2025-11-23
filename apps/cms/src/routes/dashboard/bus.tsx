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
import { useDisclosure } from "@mantine/hooks";
import { useState } from "react";
import { trpc } from "../../lib/trpc";

interface BusSchedule {
	id: string;
	driver: string;
	from: string;
	to: string;
	comment?: string;
	ttl: number;
	createdAt: string;
	updatedAt: string;
}

function BusSchedulesPage() {
	const [opened, { open, close }] = useDisclosure(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [formData, setFormData] = useState({
		driver: "",
		from: "",
		to: "",
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
		setFormData({ driver: "", from: "", to: "", comment: "" });
		setEditingId(null);
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		// Convert datetime-local format to ISO string
		const fromISO = new Date(formData.from).toISOString();
		const toISO = new Date(formData.to).toISOString();

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

	const handleEdit = (schedule: BusSchedule) => {
		setEditingId(schedule.id);
		// Convert ISO datetime to datetime-local format (YYYY-MM-DDTHH:mm)
		const fromLocal = new Date(schedule.from).toISOString().slice(0, 16);
		const toLocal = new Date(schedule.to).toISOString().slice(0, 16);
		setFormData({
			driver: schedule.driver,
			from: fromLocal,
			to: toLocal,
			comment: schedule.comment || "",
		});
		open();
	};

	const handleDelete = (id: string) => {
		if (confirm("Are you sure you want to delete this schedule?")) {
			deleteMutation.mutate({ id });
		}
	};

	return (
		<Stack>
			<Group justify="space-between">
				<Title order={2}>Bus Schedules</Title>
				<Button
					onClick={() => {
						resetForm();
						open();
					}}
				>
					Add Schedule
				</Button>
			</Group>

			<Paper withBorder p="md">
				{isLoading ? (
					<Text>Loading...</Text>
				) : schedules && schedules.items.length > 0 ? (
					<Table striped highlightOnHover>
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Driver</Table.Th>
								<Table.Th>From</Table.Th>
								<Table.Th>To</Table.Th>
								<Table.Th>Comment</Table.Th>
								<Table.Th>Actions</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{schedules.items.map((schedule) => (
								<Table.Tr key={schedule.id}>
									<Table.Td>{schedule.driver}</Table.Td>
									<Table.Td>{new Date(schedule.from).toLocaleString()}</Table.Td>
									<Table.Td>{new Date(schedule.to).toLocaleString()}</Table.Td>
									<Table.Td>{schedule.comment || "-"}</Table.Td>
									<Table.Td>
										<Group gap="xs">
											<Button size="xs" onClick={() => handleEdit(schedule)}>
												Edit
											</Button>
											<Button
												size="xs"
												color="red"
												onClick={() => handleDelete(schedule.id)}
												loading={deleteMutation.isPending}
											>
												Delete
											</Button>
										</Group>
									</Table.Td>
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
				) : (
					<Text c="dimmed">No bus schedules yet. Create one to get started.</Text>
				)}
			</Paper>

			<Modal
				opened={opened}
				onClose={() => {
					close();
					resetForm();
				}}
				title={editingId ? "Edit Bus Schedule" : "Add Bus Schedule"}
			>
				<form onSubmit={handleSubmit}>
					<Stack>
						<TextInput
							label="Driver Name"
							placeholder="e.g., John Doe"
							value={formData.driver}
							onChange={(e) => setFormData({ ...formData, driver: e.target.value })}
							required
						/>
						<TextInput
							label="From (Date & Time)"
							type="datetime-local"
							value={formData.from}
							onChange={(e) => setFormData({ ...formData, from: e.target.value })}
							required
						/>
						<TextInput
							label="To (Date & Time)"
							type="datetime-local"
							value={formData.to}
							onChange={(e) => setFormData({ ...formData, to: e.target.value })}
							required
						/>
						<Textarea
							label="Comment"
							placeholder="Additional information..."
							value={formData.comment}
							onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
							minRows={3}
						/>
						<Group justify="flex-end" mt="md">
							<Button variant="subtle" onClick={close}>
								Cancel
							</Button>
							<Button
								type="submit"
								loading={createMutation.isPending || updateMutation.isPending}
							>
								{editingId ? "Update" : "Create"}
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
