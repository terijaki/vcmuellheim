import { Accordion, ActionIcon, Badge, Box, Button, Fieldset, Group, Modal, NumberInput, Paper, SimpleGrid, Stack, Text, TextInput, Textarea, Tooltip } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import dayjs from "dayjs";
import { Archive, Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { RoleFormValue, ShiftFormValue } from "./types";

function RolesManager({ roles, onRolesChange }: { roles: RoleFormValue[]; onRolesChange: (roles: RoleFormValue[]) => void }) {
	const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
	const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);

	const addRole = () => {
		onRolesChange([...roles, { id: crypto.randomUUID(), label: "", description: "", minCapacity: 1, maxCapacity: null, minAge: null }]);
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
		<>
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
			<Box>
				<Text size="xs" c="dimmed" fw={500} mb="xs">
					Aufgaben / Rollen
				</Text>
				<Stack gap="xs">
					{roles.map((role, index) => (
						<Fieldset key={role.id} legend={role.label} bg="gray.0">
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
								<NumberInput size="xs" label="Ziel" min={1} value={role.minCapacity} onChange={(val) => updateRole(index, { minCapacity: Number(val) || 1 })} w={70} />
								<NumberInput
									size="xs"
									label="Max"
									min={1}
									placeholder="–"
									value={role.maxCapacity ?? ""}
									onChange={(val) => updateRole(index, { maxCapacity: val === "" || val === 0 ? null : Number(val) || 1 })}
									w={70}
								/>
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
				<Group justify="center">
					<Button size="xs" variant="light" leftSection={<Plus size={14} />} onClick={addRole} mt="xs">
						Rolle hinzufügen
					</Button>
				</Group>
			</Box>
		</>
	);
}

export function ShiftsManager({
	shifts,
	onShiftsChange,
	signupCountsByShiftId,
}: {
	shifts: ShiftFormValue[];
	onShiftsChange: (shifts: ShiftFormValue[]) => void;
	signupCountsByShiftId: Record<string, number>;
}) {
	const [shiftActionModal, setShiftActionModal] = useState<{ index: number; action: "delete" | "archive" } | null>(null);
	const [expandedShifts, setExpandedShifts] = useState<string[]>([]);

	const addShift = () => {
		const newId = crypto.randomUUID();
		onShiftsChange([...shifts, { id: newId, label: "", startDate: null, endDate: null, roles: [] }]);
		setExpandedShifts((prev) => [...prev, newId]);
	};

	const confirmShiftAction = () => {
		if (!shiftActionModal) return;
		const { index, action } = shiftActionModal;
		if (action === "delete") {
			onShiftsChange(shifts.filter((_, i) => i !== index));
		} else {
			const updated = [...shifts];
			updated[index] = { ...updated[index], archivedAt: new Date().toISOString() };
			onShiftsChange(updated);
		}
		setShiftActionModal(null);
	};

	const restoreShift = (index: number) => {
		const updated = [...shifts];
		updated[index] = { ...updated[index], archivedAt: undefined };
		onShiftsChange(updated);
	};

	const copyShift = (index: number) => {
		const source = shifts[index];
		const newId = crypto.randomUUID();
		const copy: ShiftFormValue = {
			...source,
			id: newId,
			label: `Kopie von ${source.label}`,
			archivedAt: undefined,
			roles: source.roles.map((r) => ({ ...r, id: crypto.randomUUID() })),
		};
		const updated = [...shifts];
		updated.splice(index + 1, 0, copy);
		onShiftsChange(updated);
		setExpandedShifts((prev) => [...prev, newId]);
	};

	const updateShift = (index: number, updates: Partial<ShiftFormValue>) => {
		const updated = [...shifts];
		updated[index] = { ...updated[index], ...updates };
		onShiftsChange(updated);
	};

	const pendingShift = shiftActionModal ? shifts[shiftActionModal.index] : null;

	return (
		<Box>
			<Modal opened={!!shiftActionModal} onClose={() => setShiftActionModal(null)} title={shiftActionModal?.action === "delete" ? "Schicht löschen?" : "Schicht archivieren?"} size="sm">
				<Text size="sm">
					{shiftActionModal?.action === "delete"
						? `Soll die Schicht "${pendingShift?.label || ""}" wirklich gelöscht werden?`
						: `Soll die Schicht "${pendingShift?.label || ""}" archiviert werden? Bestehende Anmeldungen bleiben erhalten, aber die Schicht wird für neue Anmeldungen geschlossen.`}
				</Text>
				<Group justify="flex-end" mt="md">
					<Button variant="subtle" onClick={() => setShiftActionModal(null)}>
						Abbrechen
					</Button>
					<Button color={shiftActionModal?.action === "delete" ? "red" : "orange"} onClick={confirmShiftAction}>
						{shiftActionModal?.action === "delete" ? "Löschen" : "Archivieren"}
					</Button>
				</Group>
			</Modal>

			<Text size="sm" fw={500} mb="xs">
				Schichten
			</Text>

			<Accordion multiple variant="separated" value={expandedShifts} onChange={setExpandedShifts} chevronPosition="left">
				{shifts.map((shift, index) => {
					if (shift.archivedAt) {
						return (
							<Paper key={shift.id} withBorder p={0} style={{ opacity: 0.65 }}>
								<Group px="md" py="sm" justify="space-between" align="center">
									<Group gap="xs">
										<Text size="sm" c="dimmed">
											{shift.label || "Archivierte Schicht"}
										</Text>
										<Badge size="sm" variant="outline" color="gray">
											Archiviert
										</Badge>
									</Group>
									<Button size="xs" variant="subtle" color="blue" onClick={() => restoreShift(index)}>
										Wiederherstellen
									</Button>
								</Group>
							</Paper>
						);
					}

					const signupCount = signupCountsByShiftId[shift.id] ?? 0;
					return (
						<Accordion.Item key={shift.id} value={shift.id}>
							<Accordion.Control>
								<Box>
									<Text size="sm" fw={500} truncate>
										{shift.label || "Neue Schicht"}
									</Text>
									{shift.startDate && (
										<Text size="xs" c="dimmed">
											{dayjs(shift.startDate).format("DD.MM.YYYY HH:mm")}
											{shift.endDate && ` – ${dayjs(shift.endDate).format("HH:mm")}`}
										</Text>
									)}
								</Box>
							</Accordion.Control>
							<Accordion.Panel>
								<Stack gap="sm">
									<Group align="flex-end" gap="xs">
										<TextInput
											label="Bezeichnung"
											required
											placeholder="z. B. Aufbau, Mittagsschicht, Abbau"
											value={shift.label}
											onChange={(e) => updateShift(index, { label: e.target.value })}
											style={{ flex: 1 }}
										/>
										<Tooltip label="Schicht kopieren">
											<ActionIcon color="blue" variant="subtle" onClick={() => copyShift(index)} mb={8}>
												<Copy size={16} />
											</ActionIcon>
										</Tooltip>
										{signupCount > 0 ? (
											<Tooltip label={`${signupCount} Anmeldung${signupCount !== 1 ? "en" : ""} – nur Archivieren möglich`}>
												<ActionIcon color="orange" variant="subtle" onClick={() => setShiftActionModal({ index, action: "archive" })} mb={8}>
													<Archive size={16} />
												</ActionIcon>
											</Tooltip>
										) : (
											<ActionIcon color="red" variant="subtle" onClick={() => setShiftActionModal({ index, action: "delete" })} mb={8}>
												<Trash2 size={16} />
											</ActionIcon>
										)}
									</Group>
									<SimpleGrid cols={{ base: 1, xs: 2 }}>
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

									<RolesManager roles={shift.roles} onRolesChange={(roles) => updateShift(index, { roles })} />
								</Stack>
							</Accordion.Panel>
						</Accordion.Item>
					);
				})}
			</Accordion>
			<Group justify="center">
				<Button size="xs" variant="light" leftSection={<Plus size={16} />} onClick={addShift} mt="xs">
					Schicht hinzufügen
				</Button>
			</Group>
		</Box>
	);
}
