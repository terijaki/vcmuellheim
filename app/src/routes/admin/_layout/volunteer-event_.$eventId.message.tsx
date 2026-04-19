/**
 * Admin Volunteer Event — Bulk message page
 *
 * Route: /admin/volunteer-event/$eventId/message
 *
 * Allows event organizers to compose and send a rich-text email to confirmed signups.
 * Supports filters by shift, assigned role, and date-of-birth range.
 * Deduplication by email (client-side preview + server-side send).
 */
import { createFileRoute } from "@tanstack/react-router";
import { Alert, Badge, Box, Button, Card, Group, Loader, Modal, MultiSelect, ScrollArea, Stack, Text, TextInput, Title } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { RichTextEditor } from "@mantine/tiptap";
import { Link as LinkExtension } from "@tiptap/extension-link";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useDisclosure } from "@mantine/hooks";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNotification } from "@webapp/hooks/useNotification";
import { getVolunteerEventFn, listVolunteerSignupsFn, sendVolunteerBulkEmailFn } from "@webapp/server/functions/volunteer";
import dayjs from "dayjs";
import "dayjs/locale/de";
import { Send } from "lucide-react";
import { useMemo, useState } from "react";
import type { VolunteerEvent, VolunteerSignup } from "@/lib/db/types";
import { ButtonLink } from "@/app/src/components/CustomLink";

dayjs.locale("de");

export const Route = createFileRoute("/admin/_layout/volunteer-event_/$eventId/message")({
	loader: async ({ params }) => {
		const [event, signupsData] = await Promise.all([getVolunteerEventFn({ data: { id: params.eventId } }), listVolunteerSignupsFn({ data: { eventId: params.eventId } })]);
		return { event, signups: signupsData.items };
	},
	component: VolunteerMessagePage,
});

// ---------------------------------------------------------------------------
// Recipient preview helpers
// ---------------------------------------------------------------------------

function getFilteredRecipients(
	signups: VolunteerSignup[],
	filters: {
		shiftIds: string[];
		roleIds: string[];
		minDateOfBirth: string | null;
		maxDateOfBirth: string | null;
	},
): VolunteerSignup[] {
	let filtered = signups.filter((s) => s.status === "confirmed");

	if (filters.shiftIds.length > 0) {
		filtered = filtered.filter((s) => filters.shiftIds.includes(s.shiftId));
	}
	if (filters.roleIds.length > 0) {
		filtered = filtered.filter((s) => s.assignedRoleId && filters.roleIds.includes(s.assignedRoleId));
	}
	if (filters.minDateOfBirth) {
		filtered = filtered.filter((s) => s.dateOfBirth >= filters.minDateOfBirth!);
	}
	if (filters.maxDateOfBirth) {
		filtered = filtered.filter((s) => s.dateOfBirth <= filters.maxDateOfBirth!);
	}

	// Deduplicate by email (case-insensitive)
	const seen = new Set<string>();
	const unique: VolunteerSignup[] = [];
	for (const s of filtered) {
		const key = s.email.toLowerCase();
		if (!seen.has(key)) {
			seen.add(key);
			unique.push(s);
		}
	}
	return unique;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function VolunteerMessagePage() {
	const { event: initialEvent, signups: initialSignups } = Route.useLoaderData();
	const { eventId } = Route.useParams();
	const notification = useNotification();

	const { data: event } = useQuery<VolunteerEvent>({
		queryKey: ["volunteerEvent", eventId],
		queryFn: () => getVolunteerEventFn({ data: { id: eventId } }),
		initialData: initialEvent,
	});

	const { data: signupsData } = useQuery({
		queryKey: ["volunteerSignups", eventId],
		queryFn: () => listVolunteerSignupsFn({ data: { eventId } }),
		initialData: { items: initialSignups },
	});

	const signups = signupsData.items;

	// ---------------------------------------------------------------------------
	// Filter state
	// ---------------------------------------------------------------------------
	const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([]);
	const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
	const [minDob, setMinDob] = useState<string | null>(null);
	const [maxDob, setMaxDob] = useState<string | null>(null);

	// ---------------------------------------------------------------------------
	// Form state
	// ---------------------------------------------------------------------------
	const defaultSubject = `${event.title} - Neue Nachricht`;
	const [subject, setSubject] = useState(defaultSubject);

	const editor = useEditor({
		extensions: [StarterKit, LinkExtension],
		content: "",
		immediatelyRender: false,
	});

	// ---------------------------------------------------------------------------
	// Computed: available roles based on selected shifts
	// ---------------------------------------------------------------------------
	const relevantShifts = useMemo(() => (selectedShiftIds.length > 0 ? event.shifts.filter((s) => selectedShiftIds.includes(s.id)) : event.shifts), [event.shifts, selectedShiftIds]);

	const availableRoles = useMemo(
		() =>
			relevantShifts.flatMap((s) =>
				s.roles.map((r) => ({
					value: r.id,
					label: `${r.label} (${s.label})`,
				})),
			),
		[relevantShifts],
	);

	// When shift filter changes, clear role filter selections no longer valid
	const validRoleIds = useMemo(() => new Set(availableRoles.map((r) => r.value)), [availableRoles]);

	// ---------------------------------------------------------------------------
	// Computed: recipient preview
	// ---------------------------------------------------------------------------
	const recipients = useMemo(
		() =>
			getFilteredRecipients(signups, {
				shiftIds: selectedShiftIds,
				roleIds: selectedRoleIds.filter((id) => validRoleIds.has(id)),
				minDateOfBirth: minDob,
				maxDateOfBirth: maxDob,
			}),
		[signups, selectedShiftIds, selectedRoleIds, validRoleIds, minDob, maxDob],
	);

	// ---------------------------------------------------------------------------
	// Send mutation
	// ---------------------------------------------------------------------------
	const [confirmOpened, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);
	const [sendResult, setSendResult] = useState<{
		sent: number;
		failed: { email: string; error: string }[];
	} | null>(null);

	const sendMutation = useMutation({
		mutationFn: () =>
			sendVolunteerBulkEmailFn({
				data: {
					eventId,
					subject,
					htmlBody: editor?.getHTML() ?? "",
					filters: {
						shiftIds: selectedShiftIds.length > 0 ? selectedShiftIds : undefined,
						roleIds: selectedRoleIds.filter((id) => validRoleIds.has(id)).length > 0 ? selectedRoleIds.filter((id) => validRoleIds.has(id)) : undefined,
						minDateOfBirth: minDob ?? undefined,
						maxDateOfBirth: maxDob ?? undefined,
					},
				},
			}),
		onSuccess: (result) => {
			closeConfirm();
			setSendResult(result);
			if (result.failed.length === 0) {
				notification.success(`${result.sent} E-Mail${result.sent !== 1 ? "s" : ""} erfolgreich gesendet`);
			} else {
				notification.error({
					message: `${result.sent} gesendet, ${result.failed.length} fehlgeschlagen`,
				});
			}
		},
		onError: () => {
			closeConfirm();
			notification.error({ message: "Nachrichten konnten nicht gesendet werden" });
		},
	});

	const canSend = subject.trim().length > 0 && (editor?.getText().trim().length ?? 0) > 0 && recipients.length > 0;

	// ---------------------------------------------------------------------------
	// Render
	// ---------------------------------------------------------------------------
	return (
		<>
			{/* Confirm modal */}
			<Modal opened={confirmOpened} onClose={closeConfirm} title="E-Mails senden?" size="sm">
				<Text size="sm">
					{recipients.length} E-Mail{recipients.length !== 1 ? "s" : ""} senden?
				</Text>
				<Group justify="flex-end" mt="md">
					<Button variant="subtle" onClick={closeConfirm} disabled={sendMutation.isPending}>
						Abbrechen
					</Button>
					<Button leftSection={<Send size={14} />} loading={sendMutation.isPending} onClick={() => sendMutation.mutate()}>
						Senden
					</Button>
				</Group>
			</Modal>

			<Stack gap="lg">
				{/* Header */}
				<Group justify="space-between" align="flex-start">
					<Stack gap={4}>
						<Title order={2}>Nachricht senden</Title>
						<Text size="sm" c="dimmed">
							{event.title}
						</Text>
					</Stack>
				</Group>

				{/* Send result summary */}
				{sendResult && sendResult.failed.length > 0 && (
					<Alert color="red" title="Teilweise fehlgeschlagen">
						<Stack gap="xs">
							<Text size="sm">
								{sendResult.sent} gesendet, {sendResult.failed.length} fehlgeschlagen:
							</Text>
							{sendResult.failed.map(({ email, error }) => (
								<Text key={email} size="xs" c="red">
									{email}: {error}
								</Text>
							))}
						</Stack>
					</Alert>
				)}

				{/* Filters */}
				<Card withBorder>
					<Stack gap="sm">
						<Text fw={500} size="sm">
							Empfänger filtern
						</Text>
						<MultiSelect
							label="Schichten"
							placeholder="Alle Schichten"
							data={event.shifts.map((s) => ({ value: s.id, label: s.label }))}
							value={selectedShiftIds}
							onChange={(val) => {
								setSelectedShiftIds(val);
								// Clear role selections not in new shift set
								setSelectedRoleIds((prev) =>
									prev.filter((id) =>
										event.shifts
											.filter((s) => val.includes(s.id))
											.flatMap((s) => s.roles.map((r) => r.id))
											.includes(id),
									),
								);
							}}
							clearable
						/>
						<MultiSelect
							label="Aufgaben (zugewiesene Rolle)"
							placeholder="Alle Aufgaben"
							data={availableRoles}
							value={selectedRoleIds.filter((id) => validRoleIds.has(id))}
							onChange={setSelectedRoleIds}
							clearable
							disabled={availableRoles.length === 0}
						/>
						<Group grow>
							<DatePickerInput
								label="Geboren vor"
								defaultLevel="decade"
								placeholder="z.B. min 18 Jahre"
								value={maxDob}
								onChange={(val) => setMaxDob(val)}
								locale="de"
								valueFormat="DD.MM.YYYY"
								clearable
							/>
							<DatePickerInput label="Geboren nach" defaultLevel="decade" placeholder="z.B. nur U16" value={minDob} onChange={(val) => setMinDob(val)} locale="de" valueFormat="DD.MM.YYYY" clearable />
						</Group>
					</Stack>
				</Card>

				{/* Recipient preview */}
				<Card withBorder>
					<Stack gap="xs">
						<Group justify="space-between">
							<Text fw={500} size="sm">
								Empfänger
							</Text>
							<Badge variant="light" color={recipients.length > 0 ? "blue" : "gray"}>
								{recipients.length} Empfänger
							</Badge>
						</Group>
						{recipients.length === 0 ? (
							<Text size="sm" c="dimmed">
								Keine bestätigten Anmeldungen für diese Filter.
							</Text>
						) : (
							<ScrollArea.Autosize mah={160}>
								<Group gap="xs" wrap="wrap">
									{recipients.map((r) => (
										<Badge key={r.id} size="sm" variant="outline">
											{r.firstName} {r.lastName}
										</Badge>
									))}
								</Group>
							</ScrollArea.Autosize>
						)}
					</Stack>
				</Card>

				{/* Compose */}
				<Card withBorder>
					<Stack gap="md">
						<Text fw={500} size="sm">
							Nachricht verfassen
						</Text>
						<TextInput label="Betreff" required value={subject} onChange={(e) => setSubject(e.target.value)} />
						<Box>
							<Text size="sm" fw={500} mb="xs">
								Inhalt
							</Text>
							<RichTextEditor editor={editor} styles={{ content: { "& .ProseMirror": { minHeight: 180 } } }}>
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
						{sendMutation.isPending && (
							<Group gap="xs">
								<Loader size="xs" />
								<Text size="sm" c="dimmed">
									E-Mails werden gesendet…
								</Text>
							</Group>
						)}
						<Group justify="flex-end" gap="sm">
							<ButtonLink variant="subtle" to="/admin/volunteer-event">
								Abbrechen
							</ButtonLink>

							<Button leftSection={<Send size={16} />} disabled={!canSend} onClick={openConfirm}>
								Senden ({recipients.length})
							</Button>
						</Group>
					</Stack>
				</Card>
			</Stack>
		</>
	);
}
