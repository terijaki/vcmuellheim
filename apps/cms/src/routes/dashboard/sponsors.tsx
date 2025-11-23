import type { SponsorInput } from "@lib/db/schemas";
import { ActionIcon, Anchor, Box, Button, Card, Group, Image, Modal, SimpleGrid, Stack, Text, Textarea, TextInput, Title } from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { createFileRoute } from "@tanstack/react-router";
import { Globe, Pencil, Trash2, Upload, X } from "lucide-react";
import { useState } from "react";
import { trpc } from "../../lib/trpc";

function CurrentLogoDisplay({
	logoS3Key,
	logoFile,
	deleteLogo,
	onFileChange,
	onDeleteToggle,
}: {
	logoS3Key?: string;
	logoFile: File | null;
	deleteLogo: boolean;
	onFileChange: (file: File | null) => void;
	onDeleteToggle: () => void;
}) {
	const { data: logoUrl } = trpc.upload.getFileUrl.useQuery({ s3Key: logoS3Key || "" }, { enabled: !!logoS3Key && !deleteLogo });

	// Show new file preview if selected
	if (logoFile) {
		const previewUrl = URL.createObjectURL(logoFile);
		return (
			<Box>
				<Group justify="space-between" mb="xs">
					<Text size="sm" fw={500}>
						Logo
					</Text>
					<Button size="xs" variant="subtle" color="red" leftSection={<X size={14} />} onClick={() => onFileChange(null)}>
						Abbrechen
					</Button>
				</Group>
				<Card withBorder p="md">
					<Image src={previewUrl} height={120} fit="contain" alt="Neue Logo-Vorschau" />
					<Text size="xs" c="dimmed" mt="xs" ta="center">
						Neues Logo: {logoFile.name}
					</Text>
				</Card>
			</Box>
		);
	}

	// Show current logo with actions if exists
	if (logoS3Key && !deleteLogo) {
		return (
			<Box>
				<Group justify="space-between" mb="xs">
					<Text size="sm" fw={500}>
						Aktuelles Logo
					</Text>
					<Group gap="xs">
						<Button size="xs" variant="light" leftSection={<Upload size={14} />} onClick={() => document.getElementById("logo-file-input")?.click()}>
							Ersetzen
						</Button>
						<Button size="xs" variant="light" color="red" leftSection={<X size={14} />} onClick={onDeleteToggle}>
							Löschen
						</Button>
					</Group>
				</Group>
				<Card withBorder p="md">
					{logoUrl ? (
						<Image src={logoUrl} height={120} fit="contain" alt="Aktuelles Logo" />
					) : (
						<div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
							<Text c="dimmed">Laden...</Text>
						</div>
					)}
				</Card>
				<input
					id="logo-file-input"
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

	// Show deletion message if logo was deleted
	if (deleteLogo && logoS3Key) {
		return (
			<Box>
				<Group justify="space-between" mb="xs">
					<Text size="sm" fw={500}>
						Logo
					</Text>
					<Button size="xs" variant="subtle" onClick={onDeleteToggle}>
						Rückgängig
					</Button>
				</Group>
				<Card withBorder p="md" bg="red.0">
					<Text size="sm" c="red" ta="center">
						Logo wird beim Speichern entfernt
					</Text>
				</Card>
			</Box>
		);
	}

	// Show Dropzone for new logo
	return (
		<Box>
			<Text size="sm" fw={500} mb="xs">
				Logo
			</Text>
			<Dropzone
				onDrop={(files: File[]) => files.length > 0 && onFileChange(files[0])}
				accept={IMAGE_MIME_TYPE}
				maxSize={5 * 1024 * 1024}
				maxFiles={1}
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
							Logo hierher ziehen oder klicken zum Auswählen
						</Text>
						<Text size="sm" c="dimmed" inline mt={7}>
							PNG, JPG oder SVG, max. 5MB
						</Text>
					</div>
				</Group>
			</Dropzone>
		</Box>
	);
}


function SponsorsPage() {
	const [opened, { open, close }] = useDisclosure(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [logoFile, setLogoFile] = useState<File | null>(null);
	const [deleteLogo, setDeleteLogo] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [formData, setFormData] = useState<Partial<SponsorInput>>({
		name: "",
		description: "",
		websiteUrl: "",
		logoS3Key: undefined,
	});

	const { data: sponsors, isLoading, refetch } = trpc.sponsors.list.useQuery();
	const uploadMutation = trpc.upload.getPresignedUrl.useMutation();
	const createMutation = trpc.sponsors.create.useMutation({
		onSuccess: () => {
			refetch();
			close();
			resetForm();
			setUploading(false);
			notifications.show({
				title: "Erfolg",
				message: "Sponsor wurde erfolgreich erstellt",
				color: "green",
			});
		},
		onError: (error) => {
			setUploading(false);
			notifications.show({
				title: "Fehler",
				message: error.message || "Sponsor konnte nicht erstellt werden",
				color: "red",
			});
		},
	});
	const updateMutation = trpc.sponsors.update.useMutation({
		onSuccess: () => {
			refetch();
			close();
			resetForm();
			setUploading(false);
			notifications.show({
				message: "Sponsoränderung wurde gespeichert",
				color: "green",
			});
		},
		onError: (error) => {
			setUploading(false);
			notifications.show({
				title: "Fehler",
				message: error.message || "Sponsor konnte nicht aktualisiert werden",
				color: "red",
			});
		},
	});
	const deleteMutation = trpc.sponsors.delete.useMutation({
		onSuccess: () => {
			refetch();
			notifications.show({
				title: "Erfolg",
				message: "Sponsor wurde erfolgreich gelöscht",
				color: "green",
			});
		},
		onError: (error) => {
			notifications.show({
				title: "Fehler",
				message: error.message || "Sponsor konnte nicht gelöscht werden",
				color: "red",
			});
		},
	});

	const resetForm = () => {
		setFormData({
			name: "",
			description: "",
			websiteUrl: "",
			logoS3Key: undefined,
		});
		setLogoFile(null);
		setDeleteLogo(false);
		setEditingId(null);
	};

	const handleSubmit = async () => {
		if (!formData.name) return;

		setUploading(true);
		try {
			let logoS3Key = formData.logoS3Key;

			// Handle logo deletion
			if (deleteLogo) {
				logoS3Key = undefined;
			}
			// Upload new logo if a file was selected
			else if (logoFile) {
				const { uploadUrl, key } = await uploadMutation.mutateAsync({
					filename: logoFile.name,
					contentType: logoFile.type,
					folder: "sponsors",
				});

				// Upload file to S3
				const uploadResponse = await fetch(uploadUrl, {
					method: "PUT",
					body: logoFile,
					headers: {
						"Content-Type": logoFile.type,
					},
				});

				if (!uploadResponse.ok) {
					throw new Error("Datei-Upload fehlgeschlagen");
				}

				logoS3Key = key;
			}

			// Filter out empty strings to avoid DynamoDB GSI errors
			const cleanedData = Object.fromEntries(Object.entries({ ...formData, logoS3Key }).filter(([_, value]) => value !== "" && value !== undefined));

			if (editingId) {
				updateMutation.mutate({
					id: editingId,
					data: cleanedData,
				});
			} else {
				createMutation.mutate(cleanedData as SponsorInput);
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

	const handleEdit = (sponsor: SponsorInput & { id: string }) => {
		setFormData({
			name: sponsor.name,
			description: sponsor.description || "",
			websiteUrl: sponsor.websiteUrl || "",
			logoS3Key: sponsor.logoS3Key,
		});
		setEditingId(sponsor.id);
		setDeleteLogo(false);
		setLogoFile(null);
		open();
	};

	const handleDelete = (id: string) => {
		if (window.confirm("Möchten Sie diesen Sponsor wirklich löschen?")) {
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
				<Title order={2}>Sponsoren</Title>
				<Button onClick={handleOpenNew}>Neuer Sponsor</Button>
			</Group>

			<Modal opened={opened} onClose={close} title={editingId ? "Sponsor bearbeiten" : "Neuer Sponsor"} size="lg">
				<Stack gap="md">
					<TextInput label="Name" placeholder="z.B. Firma Mustermann" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />

					<Textarea label="Beschreibung" placeholder="Optionale Beschreibung..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} minRows={3} />

					<TextInput label="Website" placeholder="https://..." value={formData.websiteUrl} onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })} />

					<CurrentLogoDisplay
						logoS3Key={formData.logoS3Key}
						logoFile={logoFile}
						deleteLogo={deleteLogo}
						onFileChange={setLogoFile}
						onDeleteToggle={() => {
							setDeleteLogo(!deleteLogo);
							setLogoFile(null);
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
			) : sponsors && sponsors.items.length > 0 ? (
				<SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
					{sponsors.items.map((sponsor) => (
						<SponsorCard key={sponsor.id} sponsor={sponsor} onEdit={handleEdit} onDelete={handleDelete} isDeleting={deleteMutation.isPending} />
					))}
				</SimpleGrid>
			) : (
				<Text c="dimmed" ta="center" py="xl">
					Keine Sponsoren vorhanden
				</Text>
			)}
		</Stack>
	);
}

function SponsorCard({
	sponsor,
	onEdit,
	onDelete,
	isDeleting,
}: {
	sponsor: SponsorInput & { id: string };
	onEdit: (sponsor: SponsorInput & { id: string }) => void;
	onDelete: (id: string) => void;
	isDeleting: boolean;
}) {
	const { data: logoUrl } = trpc.upload.getFileUrl.useQuery({ s3Key: sponsor.logoS3Key || "" }, { enabled: !!sponsor.logoS3Key });

	// Extract domain from URL for display
	const getDomainFromUrl = (url: string) => {
		try {
			const domain = new URL(url).hostname;
			return domain.replace(/^www\./, "");
		} catch {
			return url;
		}
	};

	return (
		<Card shadow="sm" padding="lg" radius="md" withBorder>
			<Card.Section withBorder>
				{logoUrl ? (
					<Image src={logoUrl} height={160} alt={sponsor.name} fit="contain" p="md" />
				) : (
					<div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--mantine-color-gray-1)" }}>
						<Text c="dimmed">Kein Logo</Text>
					</div>
				)}
			</Card.Section>

			<Stack gap="xs" mt="md">
				<Group justify="space-between" align="flex-start">
					<Title order={4} lineClamp={1}>
						{sponsor.name}
					</Title>
					<Group gap={8}>
						<ActionIcon variant="light" radius="xl" onClick={() => onEdit(sponsor)} aria-label="Bearbeiten">
							<Pencil size={16} />
						</ActionIcon>
						<ActionIcon variant="light" radius="xl" color="red" onClick={() => onDelete(sponsor.id)} loading={isDeleting} aria-label="Löschen">
							<Trash2 size={16} />
						</ActionIcon>
					</Group>
				</Group>

				{sponsor.description && (
					<Text size="sm" c="dimmed" lineClamp={2}>
						{sponsor.description}
					</Text>
				)}

				{sponsor.websiteUrl && (
					<Anchor href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer" size="sm" fw={500}>
							<Group gap="xs">
						<Globe size={14} style={{ color: "var(--mantine-color-turquoise-2)" }} />
							{getDomainFromUrl(sponsor.websiteUrl)}
					</Group>
						</Anchor>
				)}
			</Stack>
		</Card>
	);
}

export const Route = createFileRoute("/dashboard/sponsors")({
	component: SponsorsPage,
});
