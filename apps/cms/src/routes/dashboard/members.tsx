import type { MemberInput } from "@lib/db/schemas";
import { ActionIcon, Badge, Box, Button, Card, Checkbox, Group, Image, Modal, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Trash2, Upload, User, X } from "lucide-react";
import { useState } from "react";
import { trpc } from "../../lib/trpc";

function CurrentAvatarDisplay({
	avatarS3Key,
	avatarFile,
	deleteAvatar,
	onFileChange,
	onDeleteToggle,
}: {
	avatarS3Key?: string;
	avatarFile: File | null;
	deleteAvatar: boolean;
	onFileChange: (file: File | null) => void;
	onDeleteToggle: () => void;
}) {
	const { data: avatarUrl } = trpc.upload.getFileUrl.useQuery({ s3Key: avatarS3Key || "" }, { enabled: !!avatarS3Key && !deleteAvatar });

	// Show new file preview if selected
	if (avatarFile) {
		const previewUrl = URL.createObjectURL(avatarFile);
		return (
			<Box>
				<Group justify="space-between" mb="xs">
					<Text size="sm" fw={500}>
						Profilfoto
					</Text>
					<Button size="xs" variant="subtle" color="red" leftSection={<X size={14} />} onClick={() => onFileChange(null)}>
						Abbrechen
					</Button>
				</Group>
				<Card withBorder p="md">
					<Image src={previewUrl} height={120} fit="contain" alt="Neue Profilfoto-Vorschau" />
					<Text size="xs" c="dimmed" mt="xs" ta="center">
						Neues Foto: {avatarFile.name}
					</Text>
				</Card>
			</Box>
		);
	}

	// Show current avatar with actions if exists
	if (avatarS3Key && !deleteAvatar) {
		return (
			<Box>
				<Group justify="space-between" mb="xs">
					<Text size="sm" fw={500}>
						Aktuelles Profilfoto
					</Text>
					<Group gap="xs">
						<Button size="xs" variant="light" leftSection={<Upload size={14} />} onClick={() => document.getElementById("avatar-file-input")?.click()}>
							Ersetzen
						</Button>
						<Button size="xs" variant="light" color="red" leftSection={<X size={14} />} onClick={onDeleteToggle}>
							Löschen
						</Button>
					</Group>
				</Group>
				<Card withBorder p="md">
					{avatarUrl ? (
						<Image src={avatarUrl} height={120} fit="contain" alt="Aktuelles Profilfoto" />
					) : (
						<div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
							<Text c="dimmed">Laden...</Text>
						</div>
					)}
				</Card>
				<input
					id="avatar-file-input"
					type="file"
					accept="image/*"
					style={{ display: "none" }}
					onChange={(e) => {
						const file = e.target.files?.[0];
						if (file) onFileChange(file);
					}}
				/>
			</Box>
		);
	}

	// Show deletion message if avatar was deleted
	if (deleteAvatar && avatarS3Key) {
		return (
			<Box>
				<Group justify="space-between" mb="xs">
					<Text size="sm" fw={500}>
						Profilfoto
					</Text>
					<Button size="xs" variant="subtle" onClick={onDeleteToggle}>
						Rückgängig
					</Button>
				</Group>
				<Card withBorder p="md" bg="red.0">
					<Text size="sm" c="red" ta="center">
						Profilfoto wird beim Speichern entfernt
					</Text>
				</Card>
			</Box>
		);
	}

	// Show Dropzone for new avatar
	return (
		<Box>
			<Text size="sm" fw={500} mb="xs">
				Profilfoto
			</Text>
			<Dropzone onDrop={(files: File[]) => files.length > 0 && onFileChange(files[0])} accept={IMAGE_MIME_TYPE} maxSize={5 * 1024 * 1024} maxFiles={1}>
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
							Profilfoto hierher ziehen oder klicken zum Auswählen
						</Text>
						<Text size="sm" c="dimmed" inline mt={7}>
							JPG oder PNG, max. 5MB
						</Text>
					</div>
				</Group>
			</Dropzone>
		</Box>
	);
}

function MembersPage() {
	const [opened, { open, close }] = useDisclosure(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [avatarFile, setAvatarFile] = useState<File | null>(null);
	const [deleteAvatar, setDeleteAvatar] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [formData, setFormData] = useState<Partial<MemberInput>>({
		name: "",
		email: "",
		phone: "",
		isBoardMember: false,
		isTrainer: false,
		roleTitle: "",
		avatarS3Key: undefined,
	});

	const { data: members, isLoading, refetch } = trpc.members.list.useQuery();
	const uploadMutation = trpc.upload.getPresignedUrl.useMutation();
	const createMutation = trpc.members.create.useMutation({
		onSuccess: () => {
			refetch();
			close();
			resetForm();
			setUploading(false);
			notifications.show({
				title: "Erfolg",
				message: "Mitglied wurde erfolgreich erstellt",
				color: "green",
			});
		},
		onError: (error) => {
			setUploading(false);
			notifications.show({
				title: "Fehler",
				message: error.message || "Mitglied konnte nicht erstellt werden",
				color: "red",
			});
		},
	});
	const updateMutation = trpc.members.update.useMutation({
		onSuccess: () => {
			refetch();
			close();
			resetForm();
			setUploading(false);
			notifications.show({
				message: "Mitglied wurde aktualisiert",
				color: "green",
			});
		},
		onError: (error) => {
			setUploading(false);
			notifications.show({
				title: "Fehler",
				message: error.message || "Mitglied konnte nicht aktualisiert werden",
				color: "red",
			});
		},
	});
	const deleteMutation = trpc.members.delete.useMutation({
		onSuccess: () => {
			refetch();
			notifications.show({
				title: "Erfolg",
				message: "Mitglied wurde erfolgreich gelöscht",
				color: "green",
			});
		},
		onError: (error) => {
			notifications.show({
				title: "Fehler",
				message: error.message || "Mitglied konnte nicht gelöscht werden",
				color: "red",
			});
		},
	});

	const resetForm = () => {
		setFormData({
			name: "",
			email: "",
			phone: "",
			isBoardMember: false,
			isTrainer: false,
			roleTitle: "",
			avatarS3Key: undefined,
		});
		setAvatarFile(null);
		setDeleteAvatar(false);
		setEditingId(null);
	};

	const handleSubmit = async () => {
		if (!formData.name) return;

		setUploading(true);
		try {
			let avatarS3Key = formData.avatarS3Key;

			// Handle avatar deletion
			if (deleteAvatar) {
				avatarS3Key = undefined;
			}
			// Upload new avatar if a file was selected
			else if (avatarFile) {
				const { uploadUrl, key } = await uploadMutation.mutateAsync({
					filename: avatarFile.name,
					contentType: avatarFile.type,
					folder: "members",
				});

				// Upload file to S3
				const uploadResponse = await fetch(uploadUrl, {
					method: "PUT",
					body: avatarFile,
					headers: {
						"Content-Type": avatarFile.type,
					},
				});

				if (!uploadResponse.ok) {
					throw new Error("Datei-Upload fehlgeschlagen");
				}

				avatarS3Key = key;
			}

			// Filter out empty strings to avoid DynamoDB GSI errors
			const cleanedData = Object.fromEntries(Object.entries({ ...formData, avatarS3Key }).filter(([_, value]) => value !== "" && value !== undefined));

			if (editingId) {
				updateMutation.mutate({
					id: editingId,
					data: cleanedData,
				});
			} else {
				createMutation.mutate(cleanedData as MemberInput);
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

	const handleEdit = (member: MemberInput & { id: string }) => {
		setFormData({
			name: member.name,
			email: member.email || "",
			phone: member.phone || "",
			isBoardMember: member.isBoardMember || false,
			isTrainer: member.isTrainer || false,
			roleTitle: member.roleTitle || "",
			avatarS3Key: member.avatarS3Key,
		});
		setEditingId(member.id);
		setDeleteAvatar(false);
		setAvatarFile(null);
		open();
	};

	const handleDelete = (id: string) => {
		if (window.confirm("Möchten Sie dieses Mitglied wirklich löschen?")) {
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
				<Title order={2}>Mitglieder</Title>
				<Button onClick={handleOpenNew}>Neues Mitglied</Button>
			</Group>

			<Modal opened={opened} onClose={close} title={editingId ? "Mitglied bearbeiten" : "Neues Mitglied"} size="lg">
				<Stack gap="md">
					<TextInput label="Name" placeholder="z.B. Max Mustermann" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
					<TextInput label="E-Mail" placeholder="max@vcmuellheim.de" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
					<TextInput label="Telefon" placeholder="+49 123 456789" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
					<TextInput label="Funktion" placeholder="z.B. Abteilungsleiter" value={formData.roleTitle} onChange={(e) => setFormData({ ...formData, roleTitle: e.target.value })} />
					<Group gap="md">
						<Checkbox label="Board Member" checked={formData.isBoardMember} onChange={(e) => setFormData({ ...formData, isBoardMember: e.currentTarget.checked })} />
						<Checkbox label="Trainer" checked={formData.isTrainer} onChange={(e) => setFormData({ ...formData, isTrainer: e.currentTarget.checked })} />
					</Group>{" "}
					<CurrentAvatarDisplay
						avatarS3Key={formData.avatarS3Key}
						avatarFile={avatarFile}
						deleteAvatar={deleteAvatar}
						onFileChange={setAvatarFile}
						onDeleteToggle={() => {
							setDeleteAvatar(!deleteAvatar);
							setAvatarFile(null);
						}}
					/>
					<Group justify="flex-end" mt="md">
						<Button variant="subtle" onClick={close}>
							Abbrechen
						</Button>
						<Button onClick={handleSubmit} loading={uploading || createMutation.isPending || updateMutation.isPending} disabled={!formData.name}>
							{editingId ? "Aktualisieren" : "Erstellen"}
						</Button>
					</Group>
				</Stack>
			</Modal>

			{isLoading ? (
				<Text>Laden...</Text>
			) : members && members.items.length > 0 ? (
				<SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
					{members.items.map((member) => (
						<MemberCard key={member.id} member={member} onEdit={handleEdit} onDelete={handleDelete} isDeleting={deleteMutation.isPending} />
					))}
				</SimpleGrid>
			) : (
				<Text c="dimmed" ta="center" py="xl">
					Keine Mitglieder vorhanden
				</Text>
			)}
		</Stack>
	);
}

function MemberCard({
	member,
	onEdit,
	onDelete,
	isDeleting,
}: {
	member: MemberInput & { id: string };
	onEdit: (member: MemberInput & { id: string }) => void;
	onDelete: (id: string) => void;
	isDeleting: boolean;
}) {
	const { data: avatarUrl } = trpc.upload.getFileUrl.useQuery({ s3Key: member.avatarS3Key || "" }, { enabled: !!member.avatarS3Key });

	return (
		<Card shadow="sm" padding="lg" radius="md" withBorder>
			<Card.Section withBorder>
				{avatarUrl ? (
					<Image src={avatarUrl} height={200} alt={member.name} fit="cover" />
				) : (
					<div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--mantine-color-gray-1)" }}>
						<User size={60} style={{ color: "var(--mantine-color-gray-5)" }} />
					</div>
				)}
			</Card.Section>

			<Stack gap="xs" mt="md">
				<Group justify="space-between" align="flex-start">
					<Title order={4} lineClamp={1}>
						{member.name}
					</Title>
					<Group gap={8}>
						<ActionIcon variant="light" radius="xl" onClick={() => onEdit(member)} aria-label="Bearbeiten">
							<Pencil size={16} />
						</ActionIcon>
						<ActionIcon variant="light" radius="xl" color="red" onClick={() => onDelete(member.id)} loading={isDeleting} aria-label="Löschen">
							<Trash2 size={16} />
						</ActionIcon>
					</Group>
				</Group>

				{member.roleTitle && (
					<Text size="sm" fw={500} c="dimmed">
						{member.roleTitle}
					</Text>
				)}

				{member.email && (
					<Text size="sm" c="dimmed" lineClamp={1}>
						{member.email}
					</Text>
				)}

				{member.phone && (
					<Text size="sm" c="dimmed">
						{member.phone}
					</Text>
				)}

				{(member.isBoardMember || member.isTrainer) && (
					<Group gap="xs" mt="xs">
						{member.isBoardMember && (
							<Badge size="sm" variant="light" color="blue">
								Board
							</Badge>
						)}
						{member.isTrainer && (
							<Badge size="sm" variant="light" color="green">
								Trainer
							</Badge>
						)}
					</Group>
				)}
			</Stack>
		</Card>
	);
}
export const Route = createFileRoute("/dashboard/members")({
	component: MembersPage,
});
