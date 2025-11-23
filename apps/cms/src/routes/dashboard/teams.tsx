import type { TeamInput } from "@lib/db/schemas";
import { ActionIcon, Badge, Box, Button, Card, Group, Image, Modal, Paper, Select, SimpleGrid, Stack, Table, Text, Textarea, TextInput, Title } from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { createFileRoute } from "@tanstack/react-router";
import { slugify } from "@utils/slugify";
import { Trash2, Upload, X } from "lucide-react";
import { useState } from "react";
import { trpc } from "../../lib/trpc";

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
				<SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm" mb="md">
					{pictureS3Keys.map((s3Key) => (
						<PictureCard key={s3Key} s3Key={s3Key} isDeleted={deletePictureKeys.includes(s3Key)} onDeleteToggle={() => onDeleteToggle(s3Key)} />
					))}
				</SimpleGrid>
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
			<Dropzone
				onDrop={onFilesAdd}
				accept={IMAGE_MIME_TYPE}
				maxSize={5 * 1024 * 1024}
			>
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

function PictureCard({ s3Key, isDeleted, onDeleteToggle }: { s3Key: string; isDeleted: boolean; onDeleteToggle: () => void }) {
	const { data: pictureUrl } = trpc.upload.getFileUrl.useQuery({ s3Key }, { enabled: !!s3Key && !isDeleted });

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
			{pictureUrl ? <Image src={pictureUrl} height={100} fit="cover" alt="Team Bild" radius="sm" /> : <Box h={100} bg="gray.1" style={{ display: "flex", alignItems: "center", justifyContent: "center" }} />}
		</Card>
	);
}


function TeamsPage() {
	const [opened, { open, close }] = useDisclosure(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [pictureFiles, setPictureFiles] = useState<File[]>([]);
	const [deletePictureKeys, setDeletePictureKeys] = useState<string[]>([]);
	const [uploading, setUploading] = useState(false);
	const [formData, setFormData] = useState<Partial<TeamInput>>({
		name: "",
		slug: "",
		description: "",
		sbvvTeamId: "",
		ageGroup: "",
		gender: undefined,
		league: "",
		pictureS3Keys: [],
	});

	const { data: teams, isLoading, refetch } = trpc.teams.list.useQuery();
	const { data: samsTeams } = trpc.samsTeams.list.useQuery();
	const uploadMutation = trpc.upload.getPresignedUrl.useMutation();
	const createMutation = trpc.teams.create.useMutation({
		onSuccess: () => {
			refetch();
			close();
			resetForm();
			setUploading(false);
			notifications.show({
				title: "Erfolg",
				message: "Mannschaft wurde erfolgreich erstellt",
				color: "green",
			});
		},
		onError: (error) => {
			notifications.show({
				title: "Fehler",
				message: error.message || "Mannschaft konnte nicht erstellt werden",
				color: "red",
			});
		},
	});
	const updateMutation = trpc.teams.update.useMutation({
		onSuccess: () => {
			refetch();
			close();
			resetForm();
			setUploading(false);
			notifications.show({
				message: "Mannschaftsänderung wurde gespeichert",
				color: "green",
			});
		},
		onError: (error) => {
			notifications.show({
				title: "Fehler",
				message: error.message || "Mannschaft konnte nicht aktualisiert werden",
				color: "red",
			});
		},
	});
	const deleteMutation = trpc.teams.delete.useMutation({
		onSuccess: () => {
			refetch();
			notifications.show({
				title: "Erfolg",
				message: "Mannschaft wurde erfolgreich gelöscht",
				color: "green",
			});
		},
		onError: (error) => {
			notifications.show({
				title: "Fehler",
				message: error.message || "Mannschaft konnte nicht gelöscht werden",
				color: "red",
			});
		},
	});

	const resetForm = () => {
		setFormData({
			name: "",
			slug: "",
			description: "",
			sbvvTeamId: "",
			ageGroup: "",
			gender: undefined,
			league: "",
			pictureS3Keys: [],
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

			const slug = slugify(formData.name);
			const cleanedData = Object.fromEntries(
				Object.entries({ ...formData, slug, pictureS3Keys: pictureS3Keys.length > 0 ? pictureS3Keys : undefined }).filter(([_, value]) => value !== "" && value !== undefined),
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
			notifications.show({
				title: "Fehler",
				message: error instanceof Error ? error.message : "Ein Fehler ist aufgetreten",
				color: "red",
			});
			setUploading(false);
		}
	};

	const handleEdit = (team: TeamInput & { id: string }) => {
		setFormData({
			name: team.name,
			slug: team.slug,
			description: team.description || "",
			status: team.status,
			sbvvTeamId: team.sbvvTeamId || "",
			ageGroup: team.ageGroup || "",
			gender: team.gender,
			league: team.league || "",
			pictureS3Keys: team.pictureS3Keys || [],
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

	return (
		<Stack gap="md">
			<Group justify="space-between">
				<Title order={2}>Mannschaften</Title>
				<Button onClick={handleOpenNew}>Neue Mannschaft</Button>
			</Group>{" "}
			<Modal opened={opened} onClose={close} title={editingId ? "Mannschaft bearbeiten" : "Neue Mannschaft"} size="xl">
				<Stack gap="md">
					<Group align="top" grow>
						<Stack>
							<TextInput label="Name" placeholder="z.B. 1. Herren" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
							<Select
								label="Geschlecht"
								placeholder="Wählen..."
								value={formData.gender}
								onChange={(value) => setFormData({ ...formData, gender: value as "male" | "female" | "mixed" | undefined })}
								data={[
									{ value: "male", label: "Männlich" },
									{ value: "female", label: "Weiblich" },
									{ value: "mixed", label: "Gemischt" },
								]}
								required
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
									samsTeams?.map((team) => ({
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
								<Table.Th>Liga</Table.Th>
								<Table.Th>Mindestalter</Table.Th>
								<Table.Th>Geschlecht</Table.Th>
								<Table.Th>Bilder</Table.Th>
								<Table.Th>SAMS Team</Table.Th>
								<Table.Th>Aktionen</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{teams.items.map((team) => {
								const samsTeam = samsTeams?.find((st) => st.uuid === team.sbvvTeamId);
								const pictureCount = team.pictureS3Keys?.length || 0;
								return (
									<Table.Tr key={team.id}>
										<Table.Td>{team.name}</Table.Td>
										<Table.Td>{team.league || "-"}</Table.Td>
										<Table.Td>{team.ageGroup || "-"}</Table.Td>
										<Table.Td>{team.gender === "male" ? "Männlich" : team.gender === "female" ? "Weiblich" : team.gender === "mixed" ? "Gemischt" : "-"}</Table.Td>
										<Table.Td>
											{pictureCount > 0 ? (
												<Badge size="sm" variant="light">
													{pictureCount}
												</Badge>
											) : (
												"-"
											)}
										</Table.Td>
										<Table.Td>{samsTeam ? `${samsTeam.name} (${samsTeam.leagueName})` : "-"}</Table.Td>
										<Table.Td>
											<Group gap="xs">
												<Button size="xs" onClick={() => handleEdit(team)}>
													Bearbeiten
												</Button>
												<Button size="xs" color="red" onClick={() => handleDelete(team.id)} loading={deleteMutation.isPending}>
													Löschen
												</Button>
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
