/**
 * Public volunteer event page — /e/$uuid
 *
 * Shows event info, shifts, signup counts, confirmed helpers, and a signup form.
 * Handles ?token= query param for email verification.
 */

import { Alert, Badge, Button, Card, Container, Divider, Group, Modal, MultiSelect, Select, SimpleGrid, Stack, Text, TextInput, Title, Typography } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useForm } from "@tanstack/react-form-start";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import PageWithHeading from "@webapp/components/layout/PageWithHeading";
import dayjs from "dayjs";
import "dayjs/locale/de";
import { CheckCircle, MapPin } from "lucide-react";
import { useMediaQuery } from "@mantine/hooks";
import { useEffect, useRef, useState } from "react";
import { createVolunteerSignupFn, getPublicVolunteerEventFn, verifyVolunteerTokenFn } from "@webapp/server/functions/volunteer";
import { formatShiftDateRange } from "@webapp/utils/volunteer";
import type { VolunteerEvent } from "@/lib/db/types";
import { volunteerSignupDataSchema } from "@/lib/db/schemas";
import { z } from "zod";

// volunteerSignupDataSchema requires dateOfBirth as non-nullable string (server-side),
// but the form initialises dateOfBirth as null until the user picks a date.
// mobilePhone/emergencyContact are optional in the Zod schema (?:) but the form tracks them
// as required-with-undefined to satisfy TanStack Form’s StandardSchemaV1 check.
const volunteerFormSchema = volunteerSignupDataSchema.extend({
	dateOfBirth: volunteerSignupDataSchema.shape.dateOfBirth.nullable(),
	mobilePhone: z.union([z.string().trim().max(30), z.undefined()]),
	emergencyContact: z.union([z.string().trim().max(30), z.undefined()]),
});

dayjs.locale("de");

type EventDataType = Awaited<ReturnType<typeof getPublicVolunteerEventFn>>;

export const Route = createFileRoute("/_layout/e/$uuid")({
	validateSearch: (search): { token?: string } => ({
		token: typeof search.token === "string" ? search.token : undefined,
	}),
	loader: async ({ params }) => {
		try {
			const event = await getPublicVolunteerEventFn({ data: { id: params.uuid } });
			return { event };
		} catch {
			return { event: null };
		}
	},
	component: VolunteerEventPage,
});

function VolunteerEventPage() {
	const { event: initialEvent } = Route.useLoaderData();
	const { uuid } = Route.useParams();
	const { token: tokenParam } = Route.useSearch();
	const router = useRouter();

	const { data: event, refetch } = useQuery({
		queryKey: ["volunteerEvent", "public", uuid],
		queryFn: async () => {
			try {
				return await getPublicVolunteerEventFn({ data: { id: uuid } });
			} catch {
				return null;
			}
		},
		initialData: initialEvent,
	});

	// Token verification on mount
	const verifyMutation = useMutation({
		mutationFn: (tokenId: string) => verifyVolunteerTokenFn({ data: { tokenId } }),
		onSuccess: () => {
			refetch();
			router.navigate({ to: "/e/$uuid", params: { uuid }, search: {} });
		},
	});

	const verificationInitiated = useRef(false);

	useEffect(() => {
		if (tokenParam && !verificationInitiated.current) {
			verificationInitiated.current = true;
			verifyMutation.mutate(tokenParam);
		}
	}, [tokenParam, verifyMutation]);

	if (!event) {
		return (
			<PageWithHeading title="404 Fehler">
				<Container size="lg">
					<Alert color="blumine" title="Veranstaltung nicht gefunden" mt="xl" variant="white">
						Diese Veranstaltung existiert nicht oder ist nicht mehr verfügbar.
					</Alert>
				</Container>
			</PageWithHeading>
		);
	}

	return (
		<PageWithHeading title={event.title}>
			<Stack gap="xl" pb="xl">
				{/* Verification feedback */}
				{verifyMutation.isPending && (
					<Alert color="blue" title="Anmeldung wird bestätigt…">
						Bitte warten.
					</Alert>
				)}
				{verifyMutation.isSuccess && verifyMutation.data?.success && (
					<Alert color="green" icon={<CheckCircle size={18} />} title="Anmeldung bestätigt!">
						Deine Anmeldung wurde erfolgreich bestätigt. Du erhältst in Kürze eine Bestätigungsmail mit dem Termin.
					</Alert>
				)}
				{verifyMutation.isSuccess && !verifyMutation.data?.success && (
					<Alert color="orange" title="Link ungültig oder abgelaufen">
						Dieser Bestätigungslink ist ungültig oder bereits abgelaufen. Bitte melde dich erneut an, um einen neuen Link zu erhalten.
					</Alert>
				)}

				{/* Event meta */}
				{(event.description || event.location) && (
					<Card>
						<Stack gap="xs">
							{event.description && (
								<Typography>
									{/* biome-ignore lint/security/noDangerouslySetInnerHtml: description is author-supplied rich text */}
									<div dangerouslySetInnerHTML={{ __html: event.description }} />
								</Typography>
							)}
							{event.location && (
								<Group gap="xs">
									<MapPin size={16} />
									{event.locationUrl ? (
										<Text size="sm" c="dimmed" component="a" href={event.locationUrl} target="_blank" rel="noopener noreferrer">
											{event.location}
										</Text>
									) : (
										<Text size="sm" c="dimmed">
											{event.location}
										</Text>
									)}
								</Group>
							)}
						</Stack>
					</Card>
				)}

				{/* Shifts */}
				{event.shifts
					.sort((a, b) => dayjs(a.startDate).diff(dayjs(b.startDate)))
					.map((shift) => (
						<ShiftCard
							key={shift.id}
							shift={shift}
							event={event}
							signupCounts={event.signupCounts[shift.id] ?? {}}
							confirmedHelpers={event.confirmedHelpers.filter((h) => h.shiftId === shift.id)}
							onSignedUp={refetch}
						/>
					))}
			</Stack>
		</PageWithHeading>
	);
}

type ShiftCardProps = {
	shift: VolunteerEvent["shifts"][number];
	event: EventDataType;
	signupCounts: Record<string, number>;
	confirmedHelpers: { displayName: string; roleId: string | null }[];
	onSignedUp: () => void;
};

function ShiftCard({ shift, event, signupCounts, confirmedHelpers, onSignedUp }: ShiftCardProps) {
	const isPast = new Date(shift.startDate) <= new Date();
	const [modalOpen, setModalOpen] = useState(false);
	const [submitted, setSubmitted] = useState(false);
	const isMobile = useMediaQuery("(max-width: 48em)");

	const dateRangeFormatted = formatShiftDateRange(shift.startDate, shift.endDate);

	return (
		<Card withBorder>
			<Stack gap="md">
				<Group justify="space-between" align="flex-start">
					<div>
						<Title order={3}>{shift.label}</Title>
						<Text size="sm" c="dimmed">
							{dateRangeFormatted}
						</Text>
					</div>
					{isPast && (
						<Badge color="gray" variant="light">
							Vergangen
						</Badge>
					)}
				</Group>

				{/* Role capacities */}
				<SimpleGrid cols={{ base: 1, xs: 2, md: 3, lg: 4 }} spacing="xs">
					{shift.roles.map((role) => {
						const count = signupCounts[role.id] ?? 0;
						const roleHelpers = confirmedHelpers.filter((h) => h.roleId === role.id);
						return (
							<Card key={role.id} withBorder p="xs" bg="gray.0">
								<Group justify="space-between">
									<Text size="sm" fw={500}>
										{role.label}
									</Text>
									<Badge size="xs" color={count === 0 ? "red" : role.minCapacity > count ? "orange" : "green"} variant="light">
										{count} / {role.maxCapacity}
									</Badge>
								</Group>{" "}
								{role.description && (
									<Text size="xs" c="dimmed" mt={4}>
										{role.description}
									</Text>
								)}{" "}
								{roleHelpers.length > 0 && (
									<>
										<Divider my="xs" />
										<Text size="xs" c="dimmed" mt={4}>
											{roleHelpers.map((h) => h.displayName).join(", ")}
										</Text>
									</>
								)}
							</Card>
						);
					})}
				</SimpleGrid>

				{!isPast && !submitted && (
					<>
						<Divider />
						<Button onClick={() => setModalOpen(true)} ms="auto">
							Anmelden für {shift.label}
						</Button>
						<Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={shift.label} size="lg" centered fullScreen={isMobile}>
							<SignupForm
								event={event}
								shiftLabel={shift.label}
								shiftId={shift.id}
								roles={shift.roles}
								onSuccess={() => {
									setModalOpen(false);
									setSubmitted(true);
									onSignedUp();
								}}
								onCancel={() => setModalOpen(false)}
							/>
						</Modal>
					</>
				)}
				{submitted && (
					<Alert color="green" title="Anmeldung eingegangen!">
						Bitte überprüfe dein E-Mail-Postfach und bestätige deine Anmeldung innerhalb von 72 Stunden.
					</Alert>
				)}
			</Stack>
		</Card>
	);
}

type SignupFormProps = {
	event: EventDataType;
	shiftLabel: string;
	shiftId: string;
	roles: VolunteerEvent["shifts"][number]["roles"];
	onSuccess: () => void;
	onCancel: () => void;
};

function SignupForm({ event, shiftLabel, shiftId, roles, onSuccess, onCancel }: SignupFormProps) {
	const shift = event.shifts.find((s: { id: string }) => s.id === shiftId);
	const shiftStartDate = shift?.startDate ?? new Date().toISOString();
	const dateRangeFormatted = formatShiftDateRange(shiftStartDate, shift?.endDate);

	const roleOptions = roles.map((r) => ({
		value: r.id,
		label: r.minAge ? `${r.label} (ab ${r.minAge} J.)` : r.label,
		disabled: false as boolean,
	}));

	const mutation = useMutation({
		mutationFn: (formData: Parameters<typeof createVolunteerSignupFn>[0]["data"]) => createVolunteerSignupFn({ data: formData }),
		onSuccess,
	});

	const form = useForm({
		defaultValues: {
			eventId: event.id,
			shiftId,
			firstName: "",
			lastName: "",
			email: "",
			dateOfBirth: null as string | null,
			preferredRoleIds: (roles.length === 1 ? [roles[0].id] : []) as string[],
			association: "",
			mobilePhone: undefined as string | undefined,
			emergencyContact: undefined as string | undefined,
		},
		validators: {
			onChange: volunteerFormSchema,
			onSubmit: volunteerFormSchema,
		},
		onSubmit: async ({ value }) => {
			if (!value.dateOfBirth) return;
			mutation.mutate({
				firstName: value.firstName,
				lastName: value.lastName,
				email: value.email,
				dateOfBirth: dayjs(value.dateOfBirth).format("YYYY-MM-DD"),
				preferredRoleIds: value.preferredRoleIds,
				association: value.association,
				mobilePhone: value.mobilePhone || undefined,
				emergencyContact: value.emergencyContact || undefined,
				eventId: event.id,
				shiftId,
			});
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
		>
			<Stack gap="sm">
				<Text size="sm" fw="bold">
					{dateRangeFormatted}
				</Text>
				<Text c="dimmed" size="sm">
					Vielen Dank, dass du dich anmelden möchtest! Damit wir die Organisation erleichtern und im Nachgang die Kommunikation mit dir sicherstellen können, fülle bitte folgende Informationen aus.
				</Text>
				<SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
					<form.Field name="firstName">
						{(field) => (
							<TextInput label="Vorname" required withAsterisk={false} name="given-name" autoComplete="given-name" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
						)}
					</form.Field>
					<form.Field name="lastName">
						{(field) => (
							<TextInput label="Nachname" required withAsterisk={false} name="family-name" autoComplete="family-name" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
						)}
					</form.Field>
				</SimpleGrid>

				<SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
					<form.Field name="email">
						{(field) => (
							<TextInput
								label="E-Mail-Adresse"
								type="email"
								required
								withAsterisk={false}
								name="email"
								autoComplete="email"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
							/>
						)}
					</form.Field>

					<form.Field name="mobilePhone">
						{(field) => <TextInput label="Handynummer" type="tel" name="tel" autoComplete="tel" value={field.state.value ?? ""} onChange={(e) => field.handleChange(e.target.value || undefined)} />}
					</form.Field>

					<form.Field
						name="dateOfBirth"
						listeners={{
							onChange: ({ value }) => {
								if (!value) return;
								const ageAtShift = dayjs(shiftStartDate).diff(dayjs(value), "year");
								const currentIds = form.getFieldValue("preferredRoleIds") as string[];
								const eligible = currentIds.filter((id) => {
									const role = roles.find((r) => r.id === id);
									return role?.minAge === undefined || ageAtShift >= role.minAge;
								});
								if (eligible.length !== currentIds.length) {
									form.setFieldValue("preferredRoleIds", eligible);
								}
							},
						}}
					>
						{(field) => (
							<DatePickerInput
								defaultLevel="decade"
								label="Geburtsdatum"
								name="bday"
								required
								withAsterisk={false}
								value={field.state.value}
								onChange={(val) => field.handleChange(val ? val : null)}
								valueFormat="DD.MM.YYYY"
								locale="de"
								maxDate={dayjs().subtract(9, "year").toDate()}
								minDate={dayjs().subtract(90, "year").toDate()}
							/>
						)}
					</form.Field>
				</SimpleGrid>

				{roles.length > 1 && (
					<form.Subscribe selector={(state) => state.values.dateOfBirth}>
						{(dateOfBirth) => {
							const ageAtShift = dateOfBirth ? dayjs(shiftStartDate).diff(dayjs(dateOfBirth), "year") : null;
							const computedRoleOptions = roleOptions.map((opt) => {
								const role = roles.find((r) => r.id === opt.value);
								return { ...opt, disabled: ageAtShift !== null && role?.minAge !== undefined && ageAtShift < role.minAge };
							});

							return (
								<form.Field
									name="preferredRoleIds"
									validators={{
										onChangeListenTo: ["dateOfBirth"],
										onChange: ({ value }) => {
											const selected = value as string[];
											if (roles.length > 2) {
												return selected.length < 2 ? "Bitte wähle mindestens 2 Aufgaben aus." : undefined;
											}
											return selected.length < 1 ? "Bitte wähle eine Aufgabe aus." : undefined;
										},
									}}
								>
									{(field) => {
										return roles.length <= 2 ? (
											<Select
												label="Bevorzugte Aufgabe"
												required
												withAsterisk={false}
												data={computedRoleOptions}
												value={field.state.value[0] ?? null}
												onChange={(val) => field.handleChange(val ? [val] : [])}
												description="Wähle die Aufgabe aus, in der du helfen kannst."
											/>
										) : (
											<MultiSelect
												label="Bevorzugte Aufgaben (mind. 2)"
												required
												withAsterisk={false}
												data={computedRoleOptions}
												value={field.state.value}
												onChange={(val) => field.handleChange(val)}
												description="Wähle mindestens 2 Aufgaben aus, in denen du helfen kannst."
											/>
										);
									}}
								</form.Field>
							);
						}}
					</form.Subscribe>
				)}

				<form.Subscribe selector={(state) => state.values.dateOfBirth}>
					{(dateOfBirth) => {
						const ageAtShift = dateOfBirth ? dayjs(shiftStartDate).diff(dayjs(dateOfBirth), "year") : null;
						if (ageAtShift === null || ageAtShift >= 18) return null;
						return (
							<form.Field
								name="emergencyContact"
								validators={{
									onChangeListenTo: ["dateOfBirth"],
									onChange: ({ value }) => {
										const dob = form.getFieldValue("dateOfBirth");
										const age = dob ? dayjs(shiftStartDate).diff(dayjs(dob), "year") : null;
										if (age !== null && age < 18 && !value) {
											return "Bitte gib eine Notfall-Kontaktnummer an.";
										}
									},
								}}
							>
								{(field) => (
									<TextInput
										label="Notfall-Kontaktnummer (Erziehungsberechtigte/r)"
										type="tel"
										autoComplete="tel"
										required
										withAsterisk={false}
										placeholder="z. B. 0151 12345678"
										value={field.state.value ?? ""}
										onChange={(e) => field.handleChange(e.target.value || undefined)}
										description="Da du unter 18 Jahre alt bist, ist eine Notfall-Kontaktnummer erforderlich."
										error={field.state.meta.errors[0]?.toString()}
									/>
								)}
							</form.Field>
						);
					}}
				</form.Subscribe>

				<form.Field name="association">
					{(field) => <TextInput label="Vereinszugehörigkeit" placeholder="z. B. Mitglied, Familie, Freund/in, …" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />}
				</form.Field>

				<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
					{([canSubmit, isSubmitting]) => (
						<Group justify="flex-end" gap="sm">
							<Button variant="subtle" onClick={onCancel} disabled={mutation.isPending}>
								Abbrechen
							</Button>
							<Button type="submit" loading={isSubmitting || mutation.isPending} disabled={!canSubmit || isSubmitting}>
								Anmelden für {shiftLabel}
							</Button>
						</Group>
					)}
				</form.Subscribe>
			</Stack>
		</form>
	);
}
