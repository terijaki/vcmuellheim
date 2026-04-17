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
	Fieldset,
	Group,
	Menu,
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
import { RichTextEditor } from "@mantine/tiptap";
import { Link as LinkExtension } from "@tiptap/extension-link";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
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
import { ArrowLeftRight, ChevronDown, ChevronUp, ClipboardCopy, Link, Mail, Plus, SquarePen, Trash2, SquareCheckBig } from "lucide-react";
import { useEffect, useState } from "react";
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
	description: string;
	minCapacity: number;
	maxCapacity: number;
	minAge: number | null;
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
									minDate={shift.startDate || undefined}
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
	const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
	const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);

	const addRole = () => {
		onRolesChange([...roles, { id: crypto.randomUUID(), label: "", description: "", minCapacity: 1, maxCapacity: 5, minAge: null }]);
	};

	const requestRemoveRole = (index: number) => {
		setPendingDeleteIndex(index);
		openDeleteModal();
	};

	const confirmRemoveRole = () => {
		if (pendingDeleteIndex !== null) {
			onRolesChange(roles.filter((_, i) => i !== pendingDeleteIndex));
		}
		closeDeleteModal();
		setPendingDeleteIndex(null);
	};

	const updateRole = (index: number, updates: Partial<RoleFormValue>) => {
		const updated = [...roles];
		updated[index] = { ...updated[index], ...updates };
		onRolesChange(updated);
	};

	return (
		<Box pl="md" style={{ borderLeft: "2px solid var(--mantine-color-gray-3)" }}>
			<Modal opened={deleteModalOpened} onClose={closeDeleteModal} title="Rolle löschen?" size="sm">
				<Text size="sm">Soll diese Rolle wirklich gelöscht werden? Bestehende Anmeldungen verlieren ihre Rollenzuweisung, bleiben aber erhalten und können neu zugewiesen werden.</Text>
				<Group justify="flex-end" mt="md">
					<Button variant="subtle" onClick={closeDeleteModal}>
						Abbrechen
					</Button>
					<Button color="red" onClick={confirmRemoveRole}>
						Löschen
					</Button>
				</Group>
			</Modal>

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
					<Fieldset key={role.id} legend={role.label}>
						<Group gap="xs" align="flex-end">
							<TextInput
								size="xs"
								label="Bezeichnung"
								required
								withAsterisk={false}
								placeholder="z. B. Theke, Einlass, Küche"
								value={role.label}
								onChange={(e) => updateRole(index, { label: e.target.value })}
								style={{ flex: 1 }}
							/>
							<ActionIcon size="sm" color="red" variant="subtle" onClick={() => requestRemoveRole(index)} mb={2}>
								<Trash2 size={14} />
							</ActionIcon>
							<Box w={"100%"} hiddenFrom="sm" />
							<NumberInput size="xs" label="Min" min={1} value={role.minCapacity} onChange={(val) => updateRole(index, { minCapacity: Number(val) || 1 })} w={70} />
							<NumberInput size="xs" label="Max" min={1} value={role.maxCapacity} onChange={(val) => updateRole(index, { maxCapacity: Number(val) || 1 })} w={70} />
							<NumberInput
								size="xs"
								label="Mindestalter"
								suffix=" Jahre"
								min={0}
								max={90}
								value={role.minAge ?? ""}
								onChange={(val) => updateRole(index, { minAge: val === "" ? null : Number(val) })}
								placeholder="–"
								allowDecimal={false}
							/>
							<Box w={"100%"} />
							<Textarea
								size="xs"
								label="Beschreibung (optional)"
								placeholder="z. B. Getränke ausgeben, Kasse bedienen"
								value={role.description}
								onChange={(e) => updateRole(index, { description: e.target.value })}
								autosize
								maxRows={3}
								style={{ flex: 1 }}
							/>
						</Group>
					</Fieldset>
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
		roles: s.roles.map(({ minAge, ...r }) => ({
			...r,
			...(minAge !== null && minAge > 0 ? { minAge } : {}),
		})),
	}));
}

function deserializeShifts(shifts: VolunteerEvent["shifts"]): ShiftFormValue[] {
	return shifts.map((s) => ({
		id: s.id,
		label: s.label,
		startDate: new Date(s.startDate),
		endDate: s.endDate ? new Date(s.endDate) : null,
		roles: s.roles.map((r) => ({ ...r, description: r.description ?? "", minAge: r.minAge ?? null })),
	}));
}

function EventFormModal({ opened, onClose, editingEvent, onSaved }: { opened: boolean; onClose: () => void; editingEvent: VolunteerEvent | null; onSaved: () => void }) {
	const notification = useNotification();

	const editor = useEditor({
		extensions: [StarterKit, LinkExtension],
		content: editingEvent?.description ?? "",
		immediatelyRender: false,
		onUpdate: ({ editor }) => {
			form.setFieldValue("description", editor.getHTML());
		},
	});

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

	// Sync editor content when editingEvent changes (e.g. when modal re-opens for a different event)
	useEffect(() => {
		editor?.commands.setContent(editingEvent?.description ?? "");
	}, [editingEvent, editor]);

	const form = useForm({
		defaultValues: {
			title: editingEvent?.title ?? "",
			description: editingEvent?.description ?? "",
			location: editingEvent?.location ?? "",
			locationUrl: editingEvent?.locationUrl ?? "",
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
						locationUrl: value.locationUrl || undefined,
						shifts: serializedShifts,
					},
				});
			} else {
				createMutation.mutate({
					type: "volunteerEvent",
					title: value.title,
					description: value.description || undefined,
					location: value.location || undefined,
					locationUrl: value.locationUrl || undefined,
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
					<Box>
						<Text size="sm" fw={500} mb="xs">
							Beschreibung (optional)
						</Text>
						<RichTextEditor editor={editor} styles={{ content: { "& .ProseMirror": { minHeight: 100 } } }}>
							<RichTextEditor.Toolbar sticky stickyOffset={60}>
								<RichTextEditor.ControlsGroup>
									<RichTextEditor.Bold />
									<RichTextEditor.Italic />
									<RichTextEditor.ClearFormatting />
								</RichTextEditor.ControlsGroup>
								<RichTextEditor.ControlsGroup>
									<RichTextEditor.BulletList />
									<RichTextEditor.OrderedList />
								</RichTextEditor.ControlsGroup>
								<RichTextEditor.ControlsGroup>
									<RichTextEditor.Link />
									<RichTextEditor.Unlink />
								</RichTextEditor.ControlsGroup>
							</RichTextEditor.Toolbar>
							<RichTextEditor.Content />
						</RichTextEditor>
					</Box>
					<form.Field name="location">{(field) => <TextInput label="Ort (optional)" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />}</form.Field>
					<form.Field name="locationUrl">
						{(field) => <TextInput label="Link zum Ort (optional)" placeholder="https://maps.google.com/..." value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />}
					</form.Field>
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
											{dayjs(shift.startDate).format("DD.MM.YYYY HH:mm")}{" "}
											{shift.endDate && (
												<> – {dayjs(shift.endDate).isSame(dayjs(shift.startDate), "day") ? dayjs(shift.endDate).format("HH:mm") : dayjs(shift.endDate).format("DD.MM.YYYY HH:mm")}</>
											)}{" "}
										</Text>
									</Text>
									<Group gap="xs" mt={4}>
										{shift.roles.map((role) => {
											const count = shiftSignups.filter((s) => s.assignedRoleId === role.id || (!s.assignedRoleId && s.preferredRoleIds.includes(role.id))).length;
											const color = count < role.maxCapacity ? "red" : count >= role.minCapacity ? "green" : "yellow";
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
								{isMobile ? (
									<ActionIcon variant="subtle" size="md" onClick={() => toggleShift(shift.id)}>
										{shiftExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
									</ActionIcon>
								) : (
									<Button variant="subtle" size="xs" leftSection={shiftExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />} onClick={() => toggleShift(shift.id)}>
										{shiftExpanded ? "Ausblenden" : "Anmeldungen"}
									</Button>
								)}
							</Group>
							<Collapse expanded={shiftExpanded}>
								{shiftSignups.length === 0 ? (
									<Text size="sm" c="dimmed">
										Noch keine Anmeldungen.
									</Text>
								) : isMobile ? (
									<Stack gap="sm">
										{shiftSignups.map((signup) => {
											const preferredLabels = signup.preferredRoleIds.map((rid) => allRoles.find((r) => r.id === rid)?.label ?? "(gelöscht)").join(", ");
											const shiftOptions = event.shifts.filter((s) => s.id !== signup.shiftId).map((s) => ({ value: s.id, label: s.label }));
											const ageAtEvent = dayjs(shift.startDate).diff(dayjs(signup.dateOfBirth), "year");
											const ageColor = ageAtEvent >= 18 ? "green" : ageAtEvent >= 16 ? "blue" : "orange";
											return (
												<Card key={signup.id} withBorder p="xs">
													<Group justify="space-between" wrap="nowrap" mb={4}>
														<Group gap={6} wrap="nowrap">
															<Badge size="xs" variant="light" color={ageColor}>
																{ageAtEvent}
															</Badge>
															<Tooltip label={signup.association || "Keine Zugehörigkeit angegeben"}>
																<Text fw={600} size="sm">
																	{signup.firstName} {signup.lastName}
																</Text>
															</Tooltip>
														</Group>
														<Group gap={4} wrap="nowrap">
															{signup.status !== "confirmed" && (
																<Badge color="yellow" variant="light" size="xs">
																	Ausstehend
																</Badge>
															)}
															<Tooltip label={signup.email}>
																<ActionIcon size="sm" variant="transparent" component="a" href={`mailto:${signup.email}`}>
																	<Mail size={14} />
																</ActionIcon>
															</Tooltip>
														</Group>
													</Group>
													<Box fz="xs" c="dimmed" mb={4}>
														{preferredLabels || ""}
													</Box>
													<Group gap="xs">
														<Select
															size="sm"
															placeholder="Rolle zuweisen"
															clearable
															value={signup.assignedRoleId ?? null}
															onChange={(val) => assignRoleMutation.mutate({ id: signup.id, assignedRoleId: val })}
															data={shift.roles.map((r) => ({ value: r.id, label: r.label }))}
															style={{ flex: 1 }}
															clearSectionMode="rightSection"
														/>
														{shiftOptions.length > 0 && (
															<Menu>
																<Tooltip label="Schicht ändern">
																	<Menu.Target>
																		<ActionIcon size="md" variant="subtle">
																			<ArrowLeftRight size={14} />
																		</ActionIcon>
																	</Menu.Target>
																</Tooltip>
																<Menu.Dropdown>
																	{shiftOptions.map((opt) => (
																		<Menu.Item key={opt.value} onClick={() => moveShiftMutation.mutate({ id: signup.id, shiftId: opt.value })}>
																			{opt.label}
																		</Menu.Item>
																	))}
																</Menu.Dropdown>
															</Menu>
														)}
														<Group gap={4} wrap="nowrap">
															{signup.status === "pending" && (
																<Tooltip label="Manuell bestätigen">
																	<ActionIcon size="md" color="green" variant="subtle" onClick={() => confirmMutation.mutate(signup.id)} loading={confirmMutation.isPending}>
																		<SquareCheckBig size={14} />
																	</ActionIcon>
																</Tooltip>
															)}
															<Tooltip label="Löschen">
																<ActionIcon
																	size="md"
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
												<Table.Th>Status</Table.Th>
												<Table.Th>Zugewiesene Rolle</Table.Th>
												{hasMultipleShifts && <Table.Th>Schicht ändern</Table.Th>}
												<Table.Th>Aktionen</Table.Th>
											</Table.Tr>
										</Table.Thead>
										<Table.Tbody>
											{shiftSignups.map((signup) => {
												const preferredLabels = signup.preferredRoleIds.map((rid) => allRoles.find((r) => r.id === rid)?.label ?? "(gelöscht)").join(", ");
												const shiftOptions = event.shifts.filter((s) => s.id !== signup.shiftId).map((s) => ({ value: s.id, label: s.label }));
												const ageAtEvent = dayjs(shift.startDate).diff(dayjs(signup.dateOfBirth), "year");
												const ageColor = ageAtEvent >= 18 ? "green" : ageAtEvent >= 16 ? "blue" : "orange";
												return (
													<Table.Tr key={signup.id}>
														<Table.Td>
															<Tooltip label={signup.association || "Keine Zugehörigkeit angegeben"}>
																<span>
																	{signup.firstName} {signup.lastName}
																</span>
															</Tooltip>
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
																clearSectionMode="rightSection"
															/>
														</Table.Td>
														{hasMultipleShifts && (
															<Table.Td>
																{shiftOptions.length > 0 && (
																	<Menu>
																		<Tooltip label="Schicht ändern">
																			<Menu.Target>
																				<ActionIcon size="sm" variant="subtle">
																					<ArrowLeftRight size={14} />
																				</ActionIcon>
																			</Menu.Target>
																		</Tooltip>
																		<Menu.Dropdown>
																			{shiftOptions.map((opt) => (
																				<Menu.Item key={opt.value} onClick={() => moveShiftMutation.mutate({ id: signup.id, shiftId: opt.value })}>
																					{opt.label}
																				</Menu.Item>
																			))}
																		</Menu.Dropdown>
																	</Menu>
																)}
															</Table.Td>
														)}
														<Table.Td>
															<Group gap="xs" wrap="nowrap">
																{signup.status === "pending" && (
																	<Tooltip label="Manuell bestätigen">
																		<ActionIcon size="sm" color="green" variant="subtle" onClick={() => confirmMutation.mutate(signup.id)} loading={confirmMutation.isPending}>
																			<SquareCheckBig size={14} />
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
											<Text
												size="sm"
												c="dimmed"
												component={event.locationUrl ? "a" : "span"}
												href={event.locationUrl ?? undefined}
												target={event.locationUrl ? "_blank" : undefined}
												rel={event.locationUrl ? "noopener noreferrer" : undefined}
											>
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
