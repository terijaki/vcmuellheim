/**
 * Admin Volunteer Event Planner — /admin/volunteerEvent
 *
 * Provides:
 *  - List of all volunteer events with deeplink copy button
 *  - Create / edit form with dynamic shifts and roles (TrainingScheduleManager-style)
 *  - Signup dashboard grouped by shift (view signups, assign roles, force-confirm, move shift, delete)
 */

import {
	ActionIcon,
	Badge,
	Box,
	Button,
	Card,
	Collapse,
	CopyButton,
	Divider,
	Group,
	Modal,
	NumberInput,
	Select,
	SimpleGrid,
	Stack,
	Table,
	Text,
	Textarea,
	TextInput,
	Title,
	Tooltip,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { useForm } from "@tanstack/react-form-start";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNotification } from "@webapp/hooks/useNotification";
import {
	confirmVolunteerSignupFn,
	createVolunteerEventFn,
	deleteVolunteerEventFn,
	deleteVolunteerSignupFn,
	listVolunteerEventsFn,
	listVolunteerSignupsFn,
	updateVolunteerEventFn,
	updateVolunteerSignupFn,
} from "@webapp/server/functions/volunteer";
import dayjs from "dayjs";
import "dayjs/locale/de";
import { ChevronDown, ChevronUp, ClipboardCopy, Info, Link, Mail, Plus, SquarePen, Trash2 } from "lucide-react";
import { useState } from "react";
import type { VolunteerEvent } from "@/lib/db/types";

dayjs.locale("de");

export const Route = createFileRoute("/admin/_layout/volunteerEvent")({
	loader: async () => {
		const data = await listVolunteerEventsFn();
		return { events: data.items };
	},
	component: VolunteerEventAdminPage,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RoleFormValue = {
	id: string;
	label: string;
	minCapacity: number;
	maxCapacity: number;
};

type ShiftFormValue = {
	id: string;
	label: string;
	startDate: Date | null;
	endDate: Date | null;
	roles: RoleFormValue[];
};

// ---------------------------------------------------------------------------
// Shift + role manager (TrainingScheduleManager-style)
// ---------------------------------------------------------------------------

function ShiftsManager({ shifts, onShiftsChange }: { shifts: ShiftFormValue[]; onShiftsChange: (shifts: ShiftFormValue[]) => void }) {
	const addShift = () => {
		onShiftsChange([...shifts, { id: crypto.randomUUID(), label: "", startDate: null, endDate: null, roles: [] }]);
	};

	const removeShift = (index: number) => {
		onShiftsChange(shifts.filter((_, i) => i !== index));
	};

	const updateShift = (index: number, updates: Partial<ShiftFormValue>) => {
		const updated = [...shifts];
		updated[index] = { ...updated[index], ...updates };
		onShiftsChange(updated);
	};

	return (
		<Box>
			<Group justify="space-between" mb="xs">
				<Text size="sm" fw={500}>
					Schichten
				</Text>
				<Button size="xs" variant="subtle" leftSection={<Plus size={16} />} onClick={addShift}>
					Schicht hinzufügen
				</Button>
			</Group>

			<Stack gap="md">
				{shifts.map((shift, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: shifts use stable IDs generated on add; index key needed for collapse/expand state
					<Card key={shift.id} withBorder p="md">
						<Group justify="space-between" mb="md">
							<Text size="sm" fw={500}>
								Schicht {index + 1}
							</Text>
							<ActionIcon size="sm" color="red" variant="subtle" onClick={() => removeShift(index)}>
								<Trash2 size={16} />
							</ActionIcon>
						</Group>

						<Stack gap="sm">
							<TextInput label="Bezeichnung" required placeholder="z. B. Aufbau, Mittagsschicht, Abbau" value={shift.label} onChange={(e) => updateShift(index, { label: e.target.value })} />
							<SimpleGrid cols={{ base: 1, sm: 2 }}>
								<DateTimePicker
									label="Beginn"
									required
									value={shift.startDate}
									onChange={(val) => updateShift(index, { startDate: val ? new Date(val) : null })}
									locale="de"
									valueFormat="DD.MM.YYYY HH:mm"
								/>
								<DateTimePicker
									label="Ende (optional)"
									value={shift.endDate}
									onChange={(val) => updateShift(index, { endDate: val ? new Date(val) : null })}
									locale="de"
									valueFormat="DD.MM.YYYY HH:mm"
									clearable
								/>
							</SimpleGrid>

							{/* Roles within shift */}
							<RolesManager roles={shift.roles} onRolesChange={(roles) => updateShift(index, { roles })} />
						</Stack>
					</Card>
				))}
			</Stack>
		</Box>
	);
}

function RolesManager({ roles, onRolesChange }: { roles: RoleFormValue[]; onRolesChange: (roles: RoleFormValue[]) => void }) {
	const addRole = () => {
		onRolesChange([...roles, { id: crypto.randomUUID(), label: "", minCapacity: 0, maxCapacity: 5 }]);
	};

	const removeRole = (index: number) => {
		onRolesChange(roles.filter((_, i) => i !== index));
	};

	const updateRole = (index: number, updates: Partial<RoleFormValue>) => {
		const updated = [...roles];
		updated[index] = { ...updated[index], ...updates };
		onRolesChange(updated);
	};

	return (
		<Box pl="md" style={{ borderLeft: "2px solid var(--mantine-color-gray-3)" }}>
			<Group justify="space-between" mb="xs">
				<Text size="xs" c="dimmed" fw={500}>
					Aufgaben / Rollen
				</Text>
				<Button size="xs" variant="subtle" leftSection={<Plus size={14} />} onClick={addRole}>
					Rolle hinzufügen
				</Button>
			</Group>
			<Stack gap="xs">
				{roles.map((role, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: roles use stable IDs generated on add
					<Card key={role.id} withBorder p="xs">
						<Group gap="xs" align="flex-end">
							<TextInput
								size="xs"
								label="Bezeichnung"
								required
								placeholder="z. B. Theke, Einlass, Küche"
								value={role.label}
								onChange={(e) => updateRole(index, { label: e.target.value })}
								style={{ flex: 1 }}
							/>
							<NumberInput size="xs" label="Min" min={0} value={role.minCapacity} onChange={(val) => updateRole(index, { minCapacity: Number(val) || 0 })} w={70} />
							<NumberInput size="xs" label="Max" min={1} value={role.maxCapacity} onChange={(val) => updateRole(index, { maxCapacity: Number(val) || 1 })} w={70} />
							<ActionIcon size="sm" color="red" variant="subtle" onClick={() => removeRole(index)} mb={2}>
								<Trash2 size={14} />
							</ActionIcon>
						</Group>
					</Card>
				))}
			</Stack>
		</Box>
	);
}

// ---------------------------------------------------------------------------
// Event form (create / edit)
// ---------------------------------------------------------------------------

function serializeShifts(shifts: ShiftFormValue[]): VolunteerEvent["shifts"] {
	return shifts.map((s) => ({
		id: s.id,
		label: s.label,
		startDate: s.startDate?.toISOString() ?? new Date().toISOString(),
		endDate: s.endDate?.toISOString() ?? undefined,
		roles: s.roles.map((r) => ({
			id: r.id,
			label: r.label,
			minCapacity: r.minCapacity,
			maxCapacity: r.maxCapacity,
		})),
	}));
}

function deserializeShifts(shifts: VolunteerEvent["shifts"]): ShiftFormValue[] {
	return shifts.map((s) => ({
		id: s.id,
		label: s.label,
		startDate: new Date(s.startDate),
		endDate: s.endDate ? new Date(s.endDate) : null,
		roles: s.roles.map((r) => ({ ...r })),
	}));
}

function EventFormModal({ opened, onClose, editingEvent, onSaved }: { opened: boolean; onClose: () => void; editingEvent: VolunteerEvent | null; onSaved: () => void }) {
	const notification = useNotification();

	const createMutation = useMutation({
		mutationFn: (data: Parameters<typeof createVolunteerEventFn>[0]["data"]) => createVolunteerEventFn({ data }),
		onSuccess: () => {
			onSaved();
			onClose();
			notification.success("Helfereinsatz wurde erstellt");
		},
		onError: () => notification.error({ message: "Helfereinsatz konnte nicht erstellt werden" }),
	});

	const updateMutation = useMutation({
		mutationFn: (args: { id: string; data: Parameters<typeof updateVolunteerEventFn>[0]["data"]["data"] }) => updateVolunteerEventFn({ data: args }),
		onSuccess: () => {
			onSaved();
			onClose();
			notification.success("Helfereinsatz wurde aktualisiert");
		},
		onError: () => notification.error({ message: "Helfereinsatz konnte nicht aktualisiert werden" }),
	});

	const [shifts, setShifts] = useState<ShiftFormValue[]>(() => (editingEvent ? deserializeShifts(editingEvent.shifts) : []));

	const form = useForm({
		defaultValues: {
			title: editingEvent?.title ?? "",
			description: editingEvent?.description ?? "",
			location: editingEvent?.location ?? "",
		},
		onSubmit: async ({ value }) => {
			const serializedShifts = serializeShifts(shifts);
			if (editingEvent) {
				updateMutation.mutate({
					id: editingEvent.id,
					data: {
						type: "volunteerEvent",
						title: value.title,
						description: value.description || undefined,
						location: value.location || undefined,
						shifts: serializedShifts,
					},
				});
			} else {
				createMutation.mutate({
					type: "volunteerEvent",
					title: value.title,
					description: value.description || undefined,
					location: value.location || undefined,
					shifts: serializedShifts,
				});
			}
		},
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	return (
		<Modal opened={opened} onClose={onClose} title={editingEvent ? "Helfereinsatz bearbeiten" : "Neuer Helfereinsatz"} size="xl">
			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
			>
				<Stack gap="md">
					<form.Field name="title">{(field) => <TextInput label="Titel" required value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />}</form.Field>
					<form.Field name="description">
						{(field) => <Textarea label="Beschreibung (optional)" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} autosize minRows={2} />}
					</form.Field>
					<form.Field name="location">{(field) => <TextInput label="Ort (optional)" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />}</form.Field>

					<Divider label="Schichten" />
					<ShiftsManager shifts={shifts} onShiftsChange={setShifts} />

					<Group justify="flex-end">
						<Button variant="subtle" onClick={onClose} disabled={isPending}>
							Abbrechen
						</Button>
						<Button type="submit" loading={isPending}>
							{editingEvent ? "Speichern" : "Erstellen"}
						</Button>
					</Group>
				</Stack>
			</form>
		</Modal>
	);
}

// ---------------------------------------------------------------------------
// Signup dashboard for one event
// ---------------------------------------------------------------------------

function SignupDashboard({ event }: { event: VolunteerEvent }) {
	const [expandedShifts, setExpandedShifts] = useState<Set<string>>(new Set());

	const toggleShift = (id: string) => {
		setExpandedShifts((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};
	const notification = useNotification();

	const { data: signupsData, refetch } = useQuery({
		queryKey: ["volunteerSignups", event.id],
		queryFn: () => listVolunteerSignupsFn({ data: { eventId: event.id } }),
		enabled: expandedShifts.size > 0,
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => deleteVolunteerSignupFn({ data: { id } }),
		onSuccess: () => {
			refetch();
			notification.success("Anmeldung gelöscht");
		},
		onError: () => notification.error({ message: "Anmeldung konnte nicht gelöscht werden" }),
	});

	const confirmMutation = useMutation({
		mutationFn: (id: string) => confirmVolunteerSignupFn({ data: { id } }),
		onSuccess: () => {
			refetch();
			notification.success("Anmeldung bestätigt");
		},
		onError: () => notification.error({ message: "Anmeldung konnte nicht bestätigt werden" }),
	});

	const assignRoleMutation = useMutation({
		mutationFn: ({ id, assignedRoleId }: { id: string; assignedRoleId: string | null }) => updateVolunteerSignupFn({ data: { id, data: { assignedRoleId } } }),
		onSuccess: () => refetch(),
		onError: () => notification.error({ message: "Rolle konnte nicht zugewiesen werden" }),
	});

	const moveShiftMutation = useMutation({
		mutationFn: ({ id, shiftId }: { id: string; shiftId: string }) => updateVolunteerSignupFn({ data: { id, data: { shiftId } } }),
		onSuccess: () => {
			refetch();
			notification.success("Schicht geändert");
		},
		onError: () => notification.error({ message: "Schicht konnte nicht geändert werden" }),
	});

	const signups = signupsData?.items ?? [];
	const allRoles = event.shifts.flatMap((s) => s.roles.map((r) => ({ ...r, shiftId: s.id, shiftLabel: s.label })));
	const isMobile = useMediaQuery("(max-width: 62em)");
	const hasMultipleShifts = event.shifts.length > 1;

	return (
		<Box>
			<Stack gap="md" mt="sm">
				{event.shifts.map((shift) => {
					const shiftExpanded = expandedShifts.has(shift.id);
					const shiftSignups = signups.filter((s) => s.shiftId === shift.id);
					return (
						<Card key={shift.id} withBorder p="sm">
							<Group justify="space-between" mb={shiftExpanded ? "sm" : 0} wrap="nowrap" align="flex-start">
								<Box>
									<Text fw={500}>
										{shift.label} —{" "}
										<Text span size="sm" c="dimmed">
											{dayjs(shift.startDate).format("DD.MM.YYYY HH:mm")}
										</Text>
									</Text>
									<Group gap="xs" mt={4}>
										{shift.roles.map((role) => {
											const count = shiftSignups.filter((s) => s.assignedRoleId === role.id || (!s.assignedRoleId && s.preferredRoleIds.includes(role.id))).length;
											const color = count >= role.maxCapacity ? "red" : count >= role.minCapacity ? "green" : "yellow";
											return (
												<Badge key={role.id} size="sm" variant="light" color={color}>
													{role.label}: {count}/{role.maxCapacity}
												</Badge>
											);
										})}
										{shift.roles.length === 0 && (
											<Badge size="sm" variant="outline">
												{shiftSignups.length} Anmeldung{shiftSignups.length !== 1 ? "en" : ""}
											</Badge>
										)}
									</Group>
								</Box>
								<Button variant="subtle" size="xs" leftSection={shiftExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />} onClick={() => toggleShift(shift.id)}>
									{shiftExpanded ? "Ausblenden" : "Anmeldungen"}
								</Button>
							</Group>
							<Collapse expanded={shiftExpanded}>
								{shiftSignups.length === 0 ? (
									<Text size="sm" c="dimmed">
										Noch keine Anmeldungen.
									</Text>
								) : isMobile ? (
									<Stack gap="sm">
										{shiftSignups.map((signup) => {
											const preferredLabels = signup.preferredRoleIds.map((rid) => allRoles.find((r) => r.id === rid)?.label ?? rid).join(", ");
											const shiftOptions = event.shifts.filter((s) => s.id !== signup.shiftId).map((s) => ({ value: s.id, label: s.label }));
											const ageAtEvent = dayjs(shift.startDate).diff(dayjs(signup.dateOfBirth), "year");
											const ageColor = ageAtEvent >= 18 ? "green" : ageAtEvent >= 16 ? "blue" : "orange";
											return (
												<Card key={signup.id} withBorder p="xs">
													<Group justify="space-between" wrap="nowrap" mb={4}>
														<Text fw={500} size="sm">
															{signup.firstName} {signup.lastName}
														</Text>
														<Group gap={4} wrap="nowrap">
															<Badge color={signup.status === "confirmed" ? "green" : "yellow"} variant="light" size="xs">
																{signup.status === "confirmed" ? "Bestätigt" : "Ausstehend"}
															</Badge>
															<Tooltip label={signup.email}>
																<ActionIcon size="sm" variant="transparent" component="a" href={`mailto:${signup.email}`}>
																	<Mail size={14} />
																</ActionIcon>
															</Tooltip>
															<Tooltip label={signup.association || "Keine Zugehörigkeit angegeben"}>
																<ActionIcon size="sm" variant="transparent" disabled={!signup.association}>
																	<Info size={14} />
																</ActionIcon>
															</Tooltip>
														</Group>
													</Group>
													<Box fz="xs" c="dimmed" mb={4}>
														<Badge size="xs" variant="light" color={ageColor}>
															{ageAtEvent}
														</Badge>
														{preferredLabels ? ` · ${preferredLabels}` : ""}
													</Box>
													<Group gap="xs" align="flex-end">
														<Select
															size="xs"
															placeholder="Rolle zuweisen"
															clearable
															value={signup.assignedRoleId ?? null}
															onChange={(val) => assignRoleMutation.mutate({ id: signup.id, assignedRoleId: val })}
															data={shift.roles.map((r) => ({ value: r.id, label: r.label }))}
															style={{ flex: 1 }}
														/>
														{shiftOptions.length > 0 && (
															<Select
																size="xs"
																placeholder="Schicht ändern"
																value={null}
																onChange={(val) => {
																	if (val) moveShiftMutation.mutate({ id: signup.id, shiftId: val });
																}}
																data={shiftOptions}
																style={{ flex: 1 }}
															/>
														)}
														<Group gap={4} wrap="nowrap">
															{signup.status === "pending" && (
																<Tooltip label="Manuell bestätigen">
																	<ActionIcon size="sm" color="green" variant="subtle" onClick={() => confirmMutation.mutate(signup.id)} loading={confirmMutation.isPending}>
																		<SquarePen size={14} />
																	</ActionIcon>
																</Tooltip>
															)}
															<Tooltip label="Löschen">
																<ActionIcon
																	size="sm"
																	color="red"
																	variant="subtle"
																	onClick={() => {
																		if (window.confirm("Anmeldung wirklich löschen?")) {
																			deleteMutation.mutate(signup.id);
																		}
																	}}
																>
																	<Trash2 size={14} />
																</ActionIcon>
															</Tooltip>
														</Group>
													</Group>
												</Card>
											);
										})}
									</Stack>
								) : (
									<Table striped highlightOnHover withRowBorders>
										<Table.Thead>
											<Table.Tr>
												<Table.Th>Name</Table.Th>
												<Table.Th>E-Mail</Table.Th>
												<Table.Th>Alter</Table.Th>
												<Table.Th>Bevorzugte Aufgaben</Table.Th>
												<Table.Th>Zugehörigkeit</Table.Th>
												<Table.Th>Status</Table.Th>
												<Table.Th>Zugewiesene Rolle</Table.Th>
												{hasMultipleShifts && <Table.Th>Schicht ändern</Table.Th>}
												<Table.Th>Aktionen</Table.Th>
											</Table.Tr>
										</Table.Thead>
										<Table.Tbody>
											{shiftSignups.map((signup) => {
												const preferredLabels = signup.preferredRoleIds.map((rid) => allRoles.find((r) => r.id === rid)?.label ?? rid).join(", ");
												const shiftOptions = event.shifts.filter((s) => s.id !== signup.shiftId).map((s) => ({ value: s.id, label: s.label }));
												const ageAtEvent = dayjs(shift.startDate).diff(dayjs(signup.dateOfBirth), "year");
												const ageColor = ageAtEvent >= 18 ? "green" : ageAtEvent >= 16 ? "blue" : "orange";
												return (
													<Table.Tr key={signup.id}>
														<Table.Td>
															{signup.firstName} {signup.lastName}
														</Table.Td>
														<Table.Td>
															<Tooltip label={signup.email}>
																<ActionIcon size="sm" variant="subtle" component="a" href={`mailto:${signup.email}`}>
																	<Mail size={14} />
																</ActionIcon>
															</Tooltip>
														</Table.Td>
														<Table.Td>
															<Badge size="xs" variant="light" color={ageColor}>
																{ageAtEvent}
															</Badge>
														</Table.Td>
														<Table.Td>{preferredLabels}</Table.Td>
														<Table.Td>
															<Tooltip label={signup.association}>
																<ActionIcon size="sm" variant="subtle">
																	<Info size={14} />
																</ActionIcon>
															</Tooltip>
														</Table.Td>
														<Table.Td>
															<Badge color={signup.status === "confirmed" ? "green" : "yellow"} variant="light">
																{signup.status === "confirmed" ? "Bestätigt" : "Ausstehend"}
															</Badge>
														</Table.Td>
														<Table.Td>
															<Select
																size="xs"
																placeholder="Keine"
																clearable
																value={signup.assignedRoleId ?? null}
																onChange={(val) => assignRoleMutation.mutate({ id: signup.id, assignedRoleId: val })}
																data={shift.roles.map((r) => ({ value: r.id, label: r.label }))}
																w={130}
															/>
														</Table.Td>
														{hasMultipleShifts && (
															<Table.Td>
																{shiftOptions.length > 0 && (
																	<Select
																		size="xs"
																		placeholder="Schicht ändern"
																		value={null}
																		onChange={(val) => {
																			if (val) moveShiftMutation.mutate({ id: signup.id, shiftId: val });
																		}}
																		data={shiftOptions}
																		w={130}
																	/>
																)}
															</Table.Td>
														)}
														<Table.Td>
															<Group gap="xs" wrap="nowrap">
																{signup.status === "pending" && (
																	<Tooltip label="Manuell bestätigen">
																		<ActionIcon size="sm" color="green" variant="subtle" onClick={() => confirmMutation.mutate(signup.id)} loading={confirmMutation.isPending}>
																			<SquarePen size={14} />
																		</ActionIcon>
																	</Tooltip>
																)}
																<Tooltip label="Löschen">
																	<ActionIcon
																		size="sm"
																		color="red"
																		variant="subtle"
																		onClick={() => {
																			if (window.confirm("Anmeldung wirklich löschen?")) {
																				deleteMutation.mutate(signup.id);
																			}
																		}}
																	>
																		<Trash2 size={14} />
																	</ActionIcon>
																</Tooltip>
															</Group>
														</Table.Td>
													</Table.Tr>
												);
											})}
										</Table.Tbody>
									</Table>
								)}
							</Collapse>
						</Card>
					);
				})}
			</Stack>
		</Box>
	);
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function VolunteerEventAdminPage() {
	const { events: initialEvents } = Route.useLoaderData();
	const notification = useNotification();

	const { data: eventsData, refetch } = useQuery({
		queryKey: ["volunteerEvents", "admin"],
		queryFn: () => listVolunteerEventsFn(),
		initialData: { items: initialEvents },
	});

	const [formOpened, { open: openForm, close: closeForm }] = useDisclosure(false);
	const [editingEvent, setEditingEvent] = useState<VolunteerEvent | null>(null);

	const deleteMutation = useMutation({
		mutationFn: (id: string) => deleteVolunteerEventFn({ data: { id } }),
		onSuccess: () => {
			refetch();
			notification.success("Veranstaltung wurde gelöscht");
		},
		onError: () => notification.error({ message: "Veranstaltung konnte nicht gelöscht werden" }),
	});

	const events = eventsData.items;
	function openCreate() {
		setEditingEvent(null);
		openForm();
	}

	function openEdit(event: VolunteerEvent) {
		setEditingEvent(event);
		openForm();
	}

	return (
		<>
			<EventFormModal key={editingEvent?.id ?? "new"} opened={formOpened} onClose={closeForm} editingEvent={editingEvent} onSaved={refetch} />

			<Stack gap="lg">
				<Group justify="space-between">
					<Title order={2}>Veranstaltungen</Title>
					<Button leftSection={<Plus size={16} />} onClick={openCreate}>
						Neue Veranstaltung
					</Button>
				</Group>

				{events.length === 0 && (
					<Card>
						<Text c="dimmed">Noch keine Veranstaltungen erstellt.</Text>
					</Card>
				)}

				{events.map((event) => {
					const deeplink = `${typeof window !== "undefined" ? window.location.origin : ""}/e/${event.id}`;
					return (
						<Card key={event.id} withBorder>
							<Stack gap="sm">
								<Group justify="space-between" align="flex-start">
									<div>
										<Title order={4}>{event.title}</Title>
										{event.location && (
											<Text size="sm" c="dimmed">
												{event.location}
											</Text>
										)}
										<Text size="xs" c="dimmed">
											{event.shifts.length} Schicht{event.shifts.length !== 1 ? "en" : ""}
										</Text>
									</div>
									<Group gap="xs">
										<CopyButton value={deeplink}>
											{({ copied, copy }) => (
												<Tooltip label={copied ? "Kopiert!" : "Deeplink kopieren"}>
													<Button size="xs" variant="light" leftSection={copied ? <ClipboardCopy size={14} /> : <Link size={14} />} onClick={copy} color={copied ? "green" : "blue"}>
														{copied ? "Kopiert" : "Link"}
													</Button>
												</Tooltip>
											)}
										</CopyButton>
										<ActionIcon size="sm" variant="subtle" onClick={() => openEdit(event as VolunteerEvent)}>
											<SquarePen size={16} />
										</ActionIcon>
										<ActionIcon
											size="sm"
											color="red"
											variant="subtle"
											onClick={() => {
												if (window.confirm("Veranstaltung wirklich löschen?")) {
													deleteMutation.mutate(event.id);
												}
											}}
										>
											<Trash2 size={16} />
										</ActionIcon>
									</Group>
								</Group>

								<Divider />
								<SignupDashboard event={event as VolunteerEvent} />
							</Stack>
						</Card>
					);
				})}
			</Stack>
		</>
	);
}
