/**
 * Public volunteer event page — /e/$uuid
 *
 * Shows event info, shifts, signup counts, confirmed helpers, and a signup form.
 * Handles ?token= query param for email verification.
 */

import { Alert, Badge, Button, Card, Container, Divider, Group, Loader, MultiSelect, Select, SimpleGrid, Stack, Text, TextInput, Title, Typography } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useForm } from "@tanstack/react-form-start";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import PageWithHeading from "@webapp/components/layout/PageWithHeading";
import dayjs from "dayjs";
import "dayjs/locale/de";
import { CheckCircle, MapPin } from "lucide-react";
import { useState } from "react";
import { createVolunteerSignupFn, getPublicVolunteerEventFn, verifyVolunteerTokenFn } from "@webapp/server/functions/volunteer";
import type { VolunteerEvent } from "@/lib/db/types";

dayjs.locale("de");

export const Route = createFileRoute("/_layout/e/$uuid")({
	validateSearch: (search): { token?: string } => ({
		token: typeof search.token === "string" ? search.token : undefined,
	}),
	loader: async ({ params }) => {
		const event = await getPublicVolunteerEventFn({ data: { id: params.uuid } });
		return { event };
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
		queryFn: () => getPublicVolunteerEventFn({ data: { id: uuid } }),
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

	const [verificationAttempted, setVerificationAttempted] = useState(false);

	if (tokenParam && !verificationAttempted) {
		setVerificationAttempted(true);
		verifyMutation.mutate(tokenParam);
	}

	if (!event) return <Loader />;

	const [activeShiftId, setActiveShiftId] = useState<string | null>(null);

	return (
		<PageWithHeading title={event.title}>
			<Container size="lg">
				<Stack gap="xl" pb="xl">
					{/* Verification feedback */}
					{verifyMutation.isPending && (
						<Alert color="blue" title="Anmeldung wird bestätigt…">
							Bitte warten.
						</Alert>
					)}
					{verifyMutation.isSuccess && (
						<Alert color="green" icon={<CheckCircle size={18} />} title="Anmeldung bestätigt!">
							Deine Anmeldung wurde erfolgreich bestätigt. Du erhältst in Kürze eine Bestätigungsmail mit dem Termin.
						</Alert>
					)}
					{verifyMutation.isError && (
						<Alert color="red" title="Bestätigung fehlgeschlagen">
							{verifyMutation.error instanceof Error ? verifyMutation.error.message : "Ungültiger oder abgelaufener Link."}
						</Alert>
					)}

					{/* Event meta */}
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

					{/* Shifts */}
					{event.shifts.map((shift) => (
						<ShiftCard
							key={shift.id}
							shift={shift}
							event={event}
							signupCounts={event.signupCounts[shift.id] ?? {}}
							confirmedHelpers={event.confirmedHelpers.filter((h) => h.shiftId === shift.id)}
							onSignedUp={refetch}
							activeShiftId={activeShiftId}
							onFormOpen={() => setActiveShiftId(shift.id)}
							onFormClose={() => setActiveShiftId(null)}
						/>
					))}
				</Stack>
			</Container>
		</PageWithHeading>
	);
}

type ShiftCardProps = {
	shift: VolunteerEvent["shifts"][number];
	event: ReturnType<typeof Route.useLoaderData>["event"];
	signupCounts: Record<string, number>;
	confirmedHelpers: { displayName: string; roleId: string | null }[];
	onSignedUp: () => void;
	activeShiftId: string | null;
	onFormOpen: () => void;
	onFormClose: () => void;
};

function ShiftCard({ shift, event, signupCounts, confirmedHelpers, onSignedUp, activeShiftId, onFormOpen, onFormClose }: ShiftCardProps) {
	const isPast = new Date(shift.startDate) <= new Date();
	const showForm = activeShiftId === shift.id;
	const [submitted, setSubmitted] = useState(false);

	const startFormatted = dayjs(shift.startDate).format("dddd, D. MMMM YYYY [um] HH:mm [Uhr]");

	return (
		<Card withBorder>
			<Stack gap="md">
				<Group justify="space-between" align="flex-start">
					<div>
						<Title order={3}>{shift.label}</Title>
						<Text size="sm" c="dimmed">
							{startFormatted}
						</Text>
					</div>
					{isPast && (
						<Badge color="gray" variant="light">
							Vergangen
						</Badge>
					)}
				</Group>

				{/* Role capacities */}
				<SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="xs">
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
										{count} / {role.minCapacity}
									</Badge>
								</Group>
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
						{showForm ? (
							<SignupForm
								event={event}
								shiftId={shift.id}
								roles={shift.roles}
								onSuccess={() => {
									setSubmitted(true);
									onFormClose();
									onSignedUp();
								}}
								onCancel={onFormClose}
							/>
						) : (
							<Button onClick={onFormOpen} disabled={activeShiftId !== null} ms="auto">
								Anmelden für {shift.label}
							</Button>
						)}
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
	event: ReturnType<typeof Route.useLoaderData>["event"];
	shiftId: string;
	roles: VolunteerEvent["shifts"][number]["roles"];
	onSuccess: () => void;
	onCancel: () => void;
};

function SignupForm({ event, shiftId, roles, onSuccess, onCancel }: SignupFormProps) {
	const mutation = useMutation({
		mutationFn: (formData: Parameters<typeof createVolunteerSignupFn>[0]["data"]) => createVolunteerSignupFn({ data: formData }),
		onSuccess,
	});

	const form = useForm({
		defaultValues: {
			firstName: "",
			lastName: "",
			email: "",
			dateOfBirth: null as Date | null,
			preferredRoleIds: (roles.length === 1 ? [roles[0].id] : []) as string[],
			association: "",
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
				eventId: event.id,
				shiftId,
			});
		},
	});

	const roleOptions = roles.map((r) => ({ value: r.id, label: r.label }));

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
		>
			<Stack gap="sm">
				<Title order={5}>Anmeldung</Title>
				<Text c="dimmed" size="sm">
					Vielen Dank, dass du dich für diese Veranstaltung anmelden möchtest! Damit wir die Organisation erleichtern können und im Nachgang die Kommunikation sicherstellen können, bitten wir dich
					folgende Informationen anzugeben.
				</Text>
				<SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
					<form.Field name="firstName">
						{(field) => <TextInput label="Vorname" required autoComplete="given-name" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />}
					</form.Field>
					<form.Field name="lastName">
						{(field) => <TextInput label="Nachname" required autoComplete="family-name" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />}
					</form.Field>
				</SimpleGrid>

				<SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
					<form.Field name="email">
						{(field) => <TextInput label="E-Mail-Adresse" type="email" required autoComplete="email" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />}
					</form.Field>

					<form.Field name="dateOfBirth">
						{(field) => (
							<DatePickerInput
								defaultLevel="decade"
								label="Geburtsdatum"
								required
								value={field.state.value}
								onChange={(val) => field.handleChange(val ? new Date(val) : null)}
								valueFormat="DD.MM.YYYY"
								locale="de"
								maxDate={dayjs().subtract(9, "year").toDate()}
								minDate={dayjs().subtract(90, "year").toDate()}
							/>
						)}
					</form.Field>
				</SimpleGrid>

				{roles.length > 1 && (
					<form.Field name="preferredRoleIds">
						{(field) =>
							roles.length <= 3 ? (
								<Select
									label="Bevorzugte Aufgabe"
									required
									data={roleOptions}
									value={field.state.value[0] ?? null}
									onChange={(val) => field.handleChange(val ? [val] : [])}
									description="Wähle die Aufgabe aus, in der du helfen kannst."
								/>
							) : (
								<MultiSelect
									label="Bevorzugte Aufgaben (mind. 2)"
									required
									data={roleOptions}
									value={field.state.value}
									onChange={(val) => field.handleChange(val)}
									description="Wähle mindestens 2 Aufgaben aus, in denen du helfen kannst."
								/>
							)
						}
					</form.Field>
				)}

				<form.Field name="association">
					{(field) => <TextInput label="Vereinszugehörigkeit" placeholder="z. B. Mitglied, Familie, Freund/in, …" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />}
				</form.Field>

				{mutation.isError && <Alert color="red">{mutation.error instanceof Error ? mutation.error.message : "Ein Fehler ist aufgetreten."}</Alert>}

				<Group justify="flex-end" gap="sm">
					<Button variant="subtle" onClick={onCancel} disabled={mutation.isPending}>
						Abbrechen
					</Button>
					<Button type="submit" loading={mutation.isPending}>
						Anmeldung absenden
					</Button>
				</Group>
			</Stack>
		</form>
	);
}
