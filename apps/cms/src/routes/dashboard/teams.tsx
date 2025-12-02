import type { TeamInput, TrainingScheduleInput } from "@lib/db/schemas";
import {
	ActionIcon,
	Avatar,
	Badge,
	Box,
	Button,
	Card,
	Center,
	Divider,
	Group,
	Image,
	Modal,
	MultiSelect,
	Paper,
	SegmentedControl,
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
import { TimeInput } from "@mantine/dates";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Mars, Plus, SquarePen, Trash2, Upload, Venus, VenusAndMars, X } from "lucide-react";
import { useState } from "react";
import { useTRPC } from "@/apps/shared/lib/trpc-config";
import type { Member } from "@/lib/db";
import { useNotification } from "../../hooks/useNotification";

function PersonAvatar({ avatarS3Key, name }: { avatarS3Key?: string; name: string }) {
	const trpc = useTRPC();
	const { data: avatarUrl } = useQuery(trpc.upload.getFileUrl.queryOptions({ s3Key: avatarS3Key || "" }, { enabled: !!avatarS3Key }));

	return (
		<Tooltip label={name} withArrow>
			<Avatar src={avatarUrl || null} alt={name} radius="xl" />
		</Tooltip>
	);
}

function TeamPicturesManager({
	pictureS3Keys,
	pictureFiles,
	deletePictureKeys,
	onFilesAdd,
	onFileRemove,
	onDeleteToggle,
}: {
	pictureS3Keys: string[];
	pictureFiles: File[];
	deletePictureKeys: string[];
	onFilesAdd: (files: File[]) => void;
	onFileRemove: (index: number) => void;
	onDeleteToggle: (key: string) => void;
}) {
	return (
		<Box>
			<Text size="sm" fw={500} mb="xs">
				Mannschaftsbilder
			</Text>

			{/* Existing pictures */}
			{pictureS3Keys.length > 0 && (
				<Group gap="sm" mb="md">
					{pictureS3Keys.map((s3Key) => (
						<TeamPictureCard key={s3Key} s3Key={s3Key} isDeleted={deletePictureKeys.includes(s3Key)} onDeleteToggle={() => onDeleteToggle(s3Key)} />
					))}
				</Group>
			)}

			{/* New picture files */}
			{pictureFiles.length > 0 && (
				<SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm" mb="md">
					{pictureFiles.map((file, index) => {
						const previewUrl = URL.createObjectURL(file);
						return (
							<Card key={`${file.name}-${index}`} withBorder p="xs" pos="relative">
								<ActionIcon pos="absolute" top={4} right={4} size="sm" variant="filled" color="red" onClick={() => onFileRemove(index)} style={{ zIndex: 1 }}>
									<X size={14} />
								</ActionIcon>
								<Image src={previewUrl} height={100} fit="cover" alt={file.name} radius="sm" />
								<Text size="xs" c="dimmed" mt="xs" lineClamp={1} ta="center">
									{file.name}
								</Text>
							</Card>
						);
					})}
				</SimpleGrid>
			)}

			{/* Dropzone for adding pictures */}
			<Dropzone onDrop={onFilesAdd} accept={IMAGE_MIME_TYPE} maxSize={5 * 1024 * 1024}>
				<Group justify="center" gap="xl" style={{ minHeight: 120, pointerEvents: "none" }}>
					<Dropzone.Accept>
						<Upload size={50} style={{ color: "var(--mantine-color-blue-6)" }} />
					</Dropzone.Accept>
					<Dropzone.Reject>
						<X size={50} style={{ color: "var(--mantine-color-red-6)" }} />
					</Dropzone.Reject>
					<Dropzone.Idle>
						<Upload size={50} style={{ color: "var(--mantine-color-dimmed)" }} />
					</Dropzone.Idle>

					<div>
						<Text size="xl" inline>
							Bilder hierher ziehen oder klicken zum Auswählen
						</Text>
						<Text size="sm" c="dimmed" inline mt={7}>
							Mehrere Bilder möglich, max. 5MB pro Bild
						</Text>
						<Text size="xs" c="dimmed" mt="xs">
							{pictureS3Keys.length + pictureFiles.length} Bild{pictureS3Keys.length + pictureFiles.length !== 1 ? "er" : ""}
						</Text>
					</div>
				</Group>
			</Dropzone>
		</Box>
	);
}

function TeamPictureCard({ s3Key, isDeleted, onDeleteToggle }: { s3Key: string; isDeleted: boolean; onDeleteToggle: () => void }) {
	const trpc = useTRPC();
	const { data: pictureUrl } = useQuery(trpc.upload.getFileUrl.queryOptions({ s3Key }, { enabled: !!s3Key && !isDeleted }));

	if (isDeleted) {
		return (
			<Card withBorder p="xs" bg="red.0" pos="relative">
				<Box h={100} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
					<Stack gap="xs" align="center">
						<Trash2 size={24} style={{ color: "var(--mantine-color-red-6)" }} />
						<Text size="xs" c="red" fw={500}>
							Wird gelöscht
						</Text>
					</Stack>
				</Box>
				<Button size="xs" variant="subtle" fullWidth mt="xs" onClick={onDeleteToggle}>
					Rückgängig
				</Button>
			</Card>
		);
	}

	return (
		<Card withBorder p="xs" pos="relative">
			<ActionIcon pos="absolute" top={4} right={4} size="sm" variant="filled" color="red" onClick={onDeleteToggle} style={{ zIndex: 1 }}>
				<Trash2 size={14} />
			</ActionIcon>
			{pictureUrl ? (
				<Image src={pictureUrl} height={100} fit="cover" alt="Team Bild" radius="sm" />
			) : (
				<Box h={100} bg="gray.1" style={{ display: "flex", alignItems: "center", justifyContent: "center" }} />
			)}
		</Card>
	);
}

const WEEKDAYS = [
	{ value: "1", label: "Montag" },
	{ value: "2", label: "Dienstag" },
	{ value: "3", label: "Mittwoch" },
	{ value: "4", label: "Donnerstag" },
	{ value: "5", label: "Freitag" },
	{ value: "6", label: "Samstag" },
	{ value: "0", label: "Sonntag" },
];

function TrainingScheduleManager({
	schedules,
	onSchedulesChange,
	locations,
}: {
	schedules: TrainingScheduleInput[];
	onSchedulesChange: (schedules: TrainingScheduleInput[]) => void;
	locations: Array<{ id: string; name: string }>;
}) {
	const addSchedule = () => {
		onSchedulesChange([
			...schedules,
			{
				days: [],
				startTime: "18:00",
				endTime: "20:00",
				locationId: "",
			},
		]);
	};

	const removeSchedule = (index: number) => {
		onSchedulesChange(schedules.filter((_, i) => i !== index));
	};

	const updateSchedule = (index: number, updates: Partial<TrainingScheduleInput>) => {
		const updated = [...schedules];
		updated[index] = { ...updated[index], ...updates };
		onSchedulesChange(updated);
	};

	return (
		<Box>
			<Group justify="space-between" mb="xs">
				<Text size="sm" fw={500}>
					Trainingszeiten
				</Text>
				<Button size="xs" variant="subtle" leftSection={<Plus size={16} />} onClick={addSchedule}>
					Training hinzufügen
				</Button>
			</Group>

			<Stack gap="md">
				{schedules.map((schedule, index) => (
					<Card key={`${schedule.locationId}-${schedule.startTime}-${index}`} withBorder p="md">
						<Group justify="space-between" mb="md">
							<Text size="sm" fw={500}>
								Training {index + 1}
							</Text>
							<ActionIcon size="sm" color="red" variant="subtle" onClick={() => removeSchedule(index)}>
								<Trash2 size={16} />
							</ActionIcon>
						</Group>

						<Stack gap="md">
							<MultiSelect
								label="Wochentage"
								placeholder="Tage auswählen..."
								value={schedule.days.map(String)}
								onChange={(value) => updateSchedule(index, { days: value.map(Number) })}
								data={WEEKDAYS}
								required
							/>

							<Group grow>
								<TimeInput label="Startzeit" value={schedule.startTime} onChange={(e) => updateSchedule(index, { startTime: e.target.value })} required />
								<TimeInput label="Endzeit" value={schedule.endTime} onChange={(e) => updateSchedule(index, { endTime: e.target.value })} required />
							</Group>

							<Select
								label="Ort"
								placeholder="Ort auswählen..."
								value={schedule.locationId}
								onChange={(value) => updateSchedule(index, { locationId: value || "" })}
								data={locations.map((loc) => ({ value: loc.id, label: loc.name }))}
								required
								searchable
							/>
						</Stack>
					</Card>
				))}

				{schedules.length === 0 && (
					<Text size="sm" c="dimmed" ta="center" py="md">
						Keine Trainingszeiten konfiguriert
					</Text>
				)}
			</Stack>
		</Box>
	);
}

function TeamsPage() {
	const isMobile = useMediaQuery("(max-width: 48em)");
	const [opened, { open, close }] = useDisclosure(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [pictureFiles, setPictureFiles] = useState<File[]>([]);
	const [deletePictureKeys, setDeletePictureKeys] = useState<string[]>([]);
	const [uploading, setUploading] = useState(false);
	const [formData, setFormData] = useState<Partial<TeamInput>>({
		name: "",
		description: "",
		sbvvTeamId: "",
		ageGroup: "",
		gender: undefined,
		league: "",
		trainerIds: [],
		pictureS3Keys: [],
		trainingSchedules: [],
	});

	const trpc = useTRPC();
	const notification = useNotification();
	const { data: teams, isLoading, refetch } = useQuery(trpc.teams.list.queryOptions());
	const { data: samsTeams } = useQuery(trpc.samsTeams.list.queryOptions());
	const { data: trainers } = useQuery(trpc.members.trainers.queryOptions());
	const { data: members } = useQuery(trpc.members.list.queryOptions());
	const { data: locations } = useQuery(trpc.locations.list.queryOptions());
	const uploadMutation = useMutation(
		trpc.upload.getPresignedUrl.mutationOptions({
			onSuccess: () => setUploading(false),
			onError: (error: unknown) => {
				notification.error({ message: error instanceof Error ? error.message : "Upload des Fotos fehlgeschlagen" });
				setUploading(false);
			},
		}),
	);

	const createMutation = useMutation(
		trpc.teams.create.mutationOptions({
			onSuccess: () => {
				refetch();
				close();
				resetForm();
				setUploading(false);
				notification.success("Mannschaft wurde erfolgreich erstellt");
			},
			onError: (error: unknown) => {
				notification.error({ message: error instanceof Error ? error.message : "Mannschaft konnte nicht erstellt werden" });
			},
		}),
	);

	const updateMutation = useMutation(
		trpc.teams.update.mutationOptions({
			onSuccess: () => {
				refetch();
				close();
				resetForm();
				setUploading(false);
				notification.success("Mannschaftsänderung wurde gespeichert");
			},
			onError: (error: unknown) => {
				notification.error({ message: error instanceof Error ? error.message : "Mannschaft konnte nicht aktualisiert werden" });
			},
		}),
	);

	const deleteMutation = useMutation(
		trpc.teams.delete.mutationOptions({
			onSuccess: () => {
				refetch();
				notification.success("Mannschaft wurde erfolgreich gelöscht");
			},
			onError: (error: unknown) => {
				notification.error({ message: error instanceof Error ? error.message : "Mannschaft konnte nicht gelöscht werden" });
			},
		}),
	);

	const resetForm = () => {
		setFormData({
			name: "",
			description: "",
			sbvvTeamId: "",
			ageGroup: "",
			gender: undefined,
			league: "",
			trainerIds: [],
			pictureS3Keys: [],
			trainingSchedules: [],
		});
		setPictureFiles([]);
		setDeletePictureKeys([]);
		setEditingId(null);
	};

	const handleSubmit = async () => {
		if (!formData.name || !formData.gender) return;

		setUploading(true);
		try {
			let pictureS3Keys = formData.pictureS3Keys || [];

			// Remove deleted pictures
			pictureS3Keys = pictureS3Keys.filter((key) => !deletePictureKeys.includes(key));

			// Upload new pictures
			for (const file of pictureFiles) {
				const { uploadUrl, key } = await uploadMutation.mutateAsync({
					filename: file.name,
					contentType: file.type,
					folder: "teams",
				});
				const uploadResponse = await fetch(uploadUrl, {
					method: "PUT",
					body: file,
					headers: {
						"Content-Type": file.type,
					},
				});

				if (!uploadResponse.ok) {
					throw new Error(`Upload fehlgeschlagen: ${file.name}`);
				}

				pictureS3Keys.push(key);
			}

			const cleanedData = Object.fromEntries(
				Object.entries({ ...formData, pictureS3Keys: pictureS3Keys.length > 0 ? pictureS3Keys : undefined }).filter(([_, value]) => value !== "" && value !== undefined),
			);

			if (editingId) {
				updateMutation.mutate({
					id: editingId,
					data: cleanedData,
				});
			} else {
				createMutation.mutate(cleanedData as TeamInput);
			}
		} catch (error) {
			notification.error({ message: error instanceof Error ? error.message : "Ein Fehler ist aufgetreten" });
			setUploading(false);
		}
	};

	const handleEdit = (team: TeamInput & { id: string }) => {
		setFormData({
			name: team.name,
			description: team.description || "",
			sbvvTeamId: team.sbvvTeamId || "",
			ageGroup: team.ageGroup || "",
			gender: team.gender,
			league: team.league || "",
			trainerIds: team.trainerIds || [],
			pointOfContactIds: team.pointOfContactIds || [],
			pictureS3Keys: team.pictureS3Keys || [],
			trainingSchedules: team.trainingSchedules || [],
		});
		setPictureFiles([]);
		setDeletePictureKeys([]);
		setEditingId(team.id);
		open();
	};
	const handleDelete = (id: string) => {
		if (window.confirm("Möchten Sie diese Mannschaft wirklich löschen?")) {
			deleteMutation.mutate({ id });
		}
	};

	const handleOpenNew = () => {
		resetForm();
		open();
	};

	teams?.items.sort((a, b) => a.name.localeCompare(b.name));

	return (
		<Stack gap="md">
			<Group justify="space-between">
				<Title order={2}>Mannschaften</Title>
				<Button onClick={handleOpenNew} leftSection={<Plus />}>
					Neue Mannschaft
				</Button>
			</Group>{" "}
			<Modal opened={opened} onClose={close} title={editingId ? "Mannschaft bearbeiten" : "Neue Mannschaft"} size={isMobile ? "100%" : "xl"} fullScreen={isMobile}>
				<Stack gap="md" p={{ base: "md", sm: "sm" }}>
					<Group align="top" grow>
						<Stack>
							<TextInput label="Name" placeholder="z.B. 1. Herren" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
							<SegmentedControl
								fullWidth
								color={formData.gender === "male" ? "blue" : formData.gender === "female" ? "pink" : "onyx"}
								data={[
									{
										value: "male",
										label: (
											<Center style={{ gap: 10 }}>
												<Mars size={16} />
												<Text size="sm" visibleFrom="md">
													Männlich
												</Text>
											</Center>
										),
									},
									{
										value: "female",
										label: (
											<Center style={{ gap: 10 }}>
												<Venus size={16} />
												<Text size="sm" visibleFrom="md">
													Weiblich
												</Text>
											</Center>
										),
									},
									{
										value: "mixed",
										label: (
											<Center style={{ gap: 10 }}>
												<VenusAndMars size={16} />
												<Text size="sm" visibleFrom="md">
													Gemischt
												</Text>
											</Center>
										),
									},
								]}
								value={formData.gender || ""}
								onChange={(value: string) => setFormData({ ...formData, gender: value as "male" | "female" | "mixed" })}
								aria-label="Geschlecht"
							/>
							<TextInput label="Mindestalter" placeholder="z.B. U19" value={formData.ageGroup} onChange={(e) => setFormData({ ...formData, ageGroup: e.target.value })} />
						</Stack>
						<Stack>
							<TextInput label="Liga" placeholder="z.B. Landesliga" value={formData.league} onChange={(e) => setFormData({ ...formData, league: e.target.value })} />
							<Select
								label="SBVV Team"
								placeholder="Wählen..."
								value={formData.sbvvTeamId}
								onChange={(value) => setFormData({ ...formData, sbvvTeamId: value || "" })}
								data={
									samsTeams?.items.map((team) => ({
										value: team.uuid,
										label: `${team.name} (${team.leagueName || "Keine Liga"})`,
									})) || []
								}
								description="für Spielpläne, Ergebnisse und Tabelle"
								searchable
								clearable
							/>
						</Stack>
					</Group>
					<Textarea label="Beschreibung" placeholder="Optionale Beschreibung..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} minRows={3} />

					<MultiSelect
						label="Trainer"
						placeholder="Trainer auswählen..."
						value={formData.trainerIds || []}
						onChange={(value) => setFormData({ ...formData, trainerIds: value })}
						data={
							trainers?.items.map((trainer) => ({
								value: trainer.id,
								label: trainer.name,
							})) || []
						}
						description="Mehrere Trainer können ausgewählt werden"
						searchable
						clearable
					/>
					<MultiSelect
						label="Ansprechpersonen"
						placeholder="Personen auswählen..."
						value={formData.pointOfContactIds || []}
						onChange={(value) => setFormData({ ...formData, pointOfContactIds: value })}
						data={
							members?.items.map((member) => ({
								value: member.id,
								label: member.name,
							})) || []
						}
						description="Mehrere Personen können ausgewählt werden"
						searchable
						clearable
					/>

					<TrainingScheduleManager
						schedules={formData.trainingSchedules || []}
						onSchedulesChange={(schedules) => setFormData({ ...formData, trainingSchedules: schedules })}
						locations={locations?.items || []}
					/>
					<Divider />
					<TeamPicturesManager
						pictureS3Keys={formData.pictureS3Keys || []}
						pictureFiles={pictureFiles}
						deletePictureKeys={deletePictureKeys}
						onFilesAdd={(files) => setPictureFiles([...pictureFiles, ...files])}
						onFileRemove={(index) => setPictureFiles(pictureFiles.filter((_, i) => i !== index))}
						onDeleteToggle={(key) => {
							if (deletePictureKeys.includes(key)) {
								setDeletePictureKeys(deletePictureKeys.filter((k) => k !== key));
							} else {
								setDeletePictureKeys([...deletePictureKeys, key]);
							}
						}}
					/>

					<Group justify="flex-end" mt="md">
						<Button variant="subtle" onClick={close}>
							Abbrechen
						</Button>
						<Button onClick={handleSubmit} loading={uploading || createMutation.isPending || updateMutation.isPending} disabled={!formData.name || !formData.gender}>
							{editingId ? "Aktualisieren" : "Erstellen"}
						</Button>
					</Group>
				</Stack>
			</Modal>
			<Paper withBorder p="md">
				{isLoading ? (
					<Text>Laden...</Text>
				) : teams && teams.items.length > 0 ? (
					<Table striped highlightOnHover>
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Name</Table.Th>
								<Table.Th visibleFrom="lg">Liga</Table.Th>
								<Table.Th visibleFrom="lg">Mindestalter</Table.Th>
								<Table.Th hiddenFrom="lg">Alter</Table.Th>
								<Table.Th visibleFrom="lg">Geschlecht</Table.Th>
								<Table.Th hiddenFrom="lg">Geschl.</Table.Th>
								<Table.Th>Trainer</Table.Th>
								<Table.Th visibleFrom="xl">Trainingszeiten</Table.Th>
								<Table.Th hiddenFrom="xl">Zeiten</Table.Th>
								<Table.Th visibleFrom="lg">Bilder</Table.Th>
								<Table.Th visibleFrom="lg">SAMS Team</Table.Th>
								<Table.Th hiddenFrom="lg">SAMS</Table.Th>
								<Table.Th>Aktionen</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{teams.items.map((team) => {
								const samsTeam = samsTeams?.items.find((st) => st.uuid === team.sbvvTeamId);
								const pictureCount = team.pictureS3Keys?.length || 0;
								const teamPeople = new Set<Member>();
								members?.items.forEach((member) => {
									if (team.trainerIds?.includes(member.id) || team.pointOfContactIds?.includes(member.id)) {
										teamPeople.add(member);
									}
								});
								const trainingCount = team.trainingSchedules?.length || 0;
								return (
									<Table.Tr key={team.id}>
										<Table.Td>
											{team.name}
											{team.league && (
												<Text hiddenFrom="lg" size="xs">
													{team.league}
												</Text>
											)}
										</Table.Td>
										<Table.Td visibleFrom="lg">{team.league || ""}</Table.Td>
										<Table.Td>{team.ageGroup || ""}</Table.Td>
										<Table.Td c={team.gender === "male" ? "blue" : team.gender === "female" ? "pink" : "onyx"}>
											{team.gender === "male" ? <Mars size={16} /> : team.gender === "female" ? <Venus size={16} /> : <VenusAndMars size={16} />}
										</Table.Td>
										<Table.Td>
											{teamPeople.size > 0 && (
												<Avatar.Group>
													{Array.from(teamPeople).map((person) => (
														<PersonAvatar key={person.id} avatarS3Key={person.avatarS3Key} name={person.name} />
													))}
												</Avatar.Group>
											)}
										</Table.Td>
										<Table.Td>
											{trainingCount > 0 && (
												<Tooltip
													label={
														<Stack gap={4}>
															{team.trainingSchedules?.map((schedule, idx) => {
																const location = locations?.items.find((loc) => loc.id === schedule.locationId);
																const dayLabels = schedule.days.map((d) => WEEKDAYS.find((wd) => wd.value === String(d))?.label).join(", ");
																return (
																	<Text key={`${schedule.locationId}-${schedule.startTime}-${idx}`} size="xs">
																		{dayLabels}: {schedule.startTime}-{schedule.endTime} ({location?.name || "Unbekannt"})
																	</Text>
																);
															})}
														</Stack>
													}
													withArrow
												>
													<Badge size="sm" variant="light">
														{trainingCount}
													</Badge>
												</Tooltip>
											)}
										</Table.Td>
										<Table.Td visibleFrom="lg">
											{pictureCount > 0 && (
												<Badge size="sm" variant="light">
													{pictureCount}
												</Badge>
											)}
										</Table.Td>
										<Table.Td>
											{samsTeam && (
												<>
													<Stack visibleFrom="lg" gap={0}>
														<Text size="sm">{samsTeam.name}</Text>
														<Text size="xs">{samsTeam.leagueName}</Text>
													</Stack>
													<Stack hiddenFrom="lg">
														<Tooltip label={`${samsTeam.name} (${samsTeam.leagueName})`} withArrow hiddenFrom="lg">
															<Check size={16} />
														</Tooltip>
													</Stack>
												</>
											)}
										</Table.Td>

										<Table.Td>
											<Group gap="xs" wrap="nowrap">
												<Button visibleFrom="xl" size="xs" onClick={() => handleEdit(team)}>
													Bearbeiten
												</Button>
												<ActionIcon hiddenFrom="xl" variant="filled" radius="xl" onClick={() => handleEdit(team)}>
													<SquarePen size={16} />
												</ActionIcon>
												<ActionIcon variant="light" radius="xl" color="red" onClick={() => handleDelete(team.id)} loading={deleteMutation.isPending}>
													<Trash2 size={16} />
												</ActionIcon>
											</Group>
										</Table.Td>
									</Table.Tr>
								);
							})}
						</Table.Tbody>
					</Table>
				) : (
					<Text>Keine Mannschaften vorhanden</Text>
				)}
			</Paper>
		</Stack>
	);
}

export const Route = createFileRoute("/dashboard/teams")({
	component: TeamsPage,
});
