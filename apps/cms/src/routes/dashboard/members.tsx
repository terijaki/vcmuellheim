import type { MemberInput } from "@lib/db/schemas";
import { ActionIcon, Badge, Box, Button, Card, Checkbox, Flex, Grid, Group, Image, Modal, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2, Upload, User, X } from "lucide-react";
import { useState } from "react";
import { useTRPC } from "@/apps/shared/lib/trpc-config";
import { useNotification } from "../../hooks/useNotification";

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
	const trpc = useTRPC();
	const { data: avatarUrl } = useQuery(trpc.upload.getFileUrl.queryOptions({ s3Key: avatarS3Key || "" }, { enabled: !!avatarS3Key && !deleteAvatar }));

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
			<Dropzone
				onDrop={(files: File[]) => files.length > 0 && onFileChange(files[0])}
				accept={IMAGE_MIME_TYPE}
				maxSize={5 * 1024 * 1024}
				maxFiles={1}
				bd="1px dashed var(--mantine-color-dimmed)"
				p="xs"
			>
				<Flex direction={{ base: "row", md: "column" }} justify="center" rowGap="md" columnGap="md" mih={{ base: 80, md: 120 }} style={{ pointerEvents: "none" }}>
					<Dropzone.Accept>
						<Upload size={50} style={{ color: "var(--mantine-color-blue-6)" }} />
					</Dropzone.Accept>
					<Dropzone.Reject>
						<X size={50} style={{ color: "var(--mantine-color-red-6)" }} />
					</Dropzone.Reject>
					<Dropzone.Idle>
						<Upload size={50} style={{ color: "var(--mantine-color-dimmed)" }} />
					</Dropzone.Idle>

					<Stack gap="xs" align="center">
						<Text size="lg" inline>
							Profilfoto hierher ziehen oder klicken zum Auswählen
						</Text>
						<Text size="sm" c="dimmed" inline mt={7}>
							JPG oder PNG, max. 5MB
						</Text>
					</Stack>
				</Flex>
			</Dropzone>
		</Box>
	);
}

function MembersPage() {
	const isMobile = useMediaQuery("(max-width: 48em)");
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

	const trpc = useTRPC();
	const notification = useNotification();
	const { data: members, isLoading, refetch } = useQuery(trpc.members.list.queryOptions());
	const uploadMutation = useMutation(
		trpc.upload.getPresignedUrl.mutationOptions({
			onError: (error: unknown) => {
				setUploading(false);
				notification.error({
					message: error instanceof Error ? error.message : "Upload fehlgeschlagen",
				});
			},
		}),
	);

	const createMutation = useMutation(
		trpc.members.create.mutationOptions({
			onSuccess: () => {
				refetch();
				close();
				resetForm();
				setUploading(false);
				notification.success("Mitglied wurde erfolgreich erstellt");
			},
			onError: (error: unknown) => {
				setUploading(false);
				notification.error({
					message: error instanceof Error ? error.message : "Mitglied konnte nicht erstellt werden",
				});
			},
		}),
	);

	const updateMutation = useMutation(
		trpc.members.update.mutationOptions({
			onSuccess: () => {
				refetch();
				close();
				resetForm();
				setUploading(false);
				notification.success("Mitglied wurde aktualisiert");
			},
			onError: (error: unknown) => {
				setUploading(false);
				notification.error({
					message: error instanceof Error ? error.message : "Mitglied konnte nicht aktualisiert werden",
				});
			},
		}),
	);

	const deleteMutation = useMutation(
		trpc.members.delete.mutationOptions({
			onSuccess: () => {
				refetch();
				close();
				resetForm();
				setEditingId(null);
				notification.success("Mitglied wurde erfolgreich gelöscht");
			},
			onError: (error: unknown) => {
				notification.error({
					message: error instanceof Error ? error.message : "Mitglied konnte nicht gelöscht werden",
				});
			},
		}),
	);

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
			notification.error({
				message: error instanceof Error ? error.message : "Ein Fehler ist aufgetreten",
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
				<Button onClick={handleOpenNew} leftSection={<Plus />} visibleFrom="sm">
					Neues Mitglied
				</Button>
				<ActionIcon onClick={handleOpenNew} hiddenFrom="sm" variant="filled" radius="xl">
					<Plus size={20} />
				</ActionIcon>
			</Group>

			<Modal opened={opened} onClose={close} title={editingId ? "Mitglied bearbeiten" : "Neues Mitglied"} size={isMobile ? "100%" : "lg"} fullScreen={isMobile}>
				<Stack gap="md" p={{ base: "md", sm: "sm" }}>
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
					<Group justify="space-between" mt="md">
						{editingId && (
							<>
								<ActionIcon hiddenFrom="sm" color="red" variant="light" onClick={() => handleDelete(editingId)} loading={deleteMutation.isPending} size="lg">
									<Trash2 />
								</ActionIcon>
								<Button visibleFrom="sm" color="red" variant="light" onClick={() => handleDelete(editingId)} loading={deleteMutation.isPending}>
									Löschen
								</Button>
							</>
						)}
						<Group gap="xs">
							<Button variant="light" onClick={close}>
								Abbrechen
							</Button>
							<Button variant="filled" onClick={handleSubmit} loading={uploading || createMutation.isPending || updateMutation.isPending} disabled={!formData.name}>
								{editingId ? "Aktualisieren" : "Erstellen"}
							</Button>
						</Group>
					</Group>
				</Stack>
			</Modal>

			{isLoading ? (
				<Text>Laden...</Text>
			) : members && members.items.length > 0 ? (
				<SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="md">
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

function MemberCard({ member, onEdit }: { member: MemberInput & { id: string }; onEdit: (member: MemberInput & { id: string }) => void; onDelete: (id: string) => void; isDeleting: boolean }) {
	const trpc = useTRPC();
	const { data: avatarUrl } = useQuery(trpc.upload.getFileUrl.queryOptions({ s3Key: member.avatarS3Key || "" }, { enabled: !!member.avatarS3Key }));

	return (
		<Card shadow="sm" p="0" radius="md" withBorder>
			<Grid align="stretch" justify="stretch" gutter={0} style={{ display: "flex", height: "100%" }}>
				<Grid.Col span={4} bg="blue">
					{avatarUrl ? (
						<Image src={avatarUrl} alt={member.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
					) : (
						<Flex justify="center" align="center" bg="gray" h="100%">
							<User size={60} style={{ color: "var(--mantine-color-gray-5)" }} />
						</Flex>
					)}
				</Grid.Col>
				<Grid.Col span="auto" style={{ display: "flex", height: "100%" }}>
					<Stack gap="xs" p="lg" justify="space-between" style={{ flex: 1 }}>
						<Group justify="space-between" align="flex-start">
							<Title order={4} lineClamp={2} style={{ flex: 1 }}>
								{member.name}
							</Title>

							<ActionIcon variant="filled" radius="xl" onClick={() => onEdit(member)} aria-label="Bearbeiten">
								<Pencil size={16} />
							</ActionIcon>
						</Group>

						<Stack justify="flex-end" style={{ flex: 1 }}>
							<Text size="sm" fw={500} c="dimmed" lineClamp={1}>
								{member.roleTitle}
							</Text>
							<Text size="sm" c="dimmed" lineClamp={1}>
								{member.email}
							</Text>
							<Text size="sm" c="dimmed" lineClamp={1}>
								{member.phone}
							</Text>
						</Stack>

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
					</Stack>
				</Grid.Col>
			</Grid>
		</Card>
	);
}
export const Route = createFileRoute("/dashboard/members")({
	component: MembersPage,
});
