import type { NewsInput } from "@lib/db/schemas";
import { ActionIcon, Badge, Box, Button, Card, Group, Image, Modal, Paper, Select, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { RichTextEditor } from "@mantine/tiptap";
import { createFileRoute } from "@tanstack/react-router";
import { Image as ImageExtension } from "@tiptap/extension-image";
import { Link as LinkExtension } from "@tiptap/extension-link";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { slugify } from "@utils/slugify";
import dayjs from "dayjs";
import { Trash2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { trpc } from "../../lib/trpc";

function NewsPage() {
	const [opened, { open, close }] = useDisclosure(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [deleteImage, setDeleteImage] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [formData, setFormData] = useState<Partial<NewsInput>>({
		title: "",
		slug: "",
		content: "",
		excerpt: "",
		publishedDate: new Date().toISOString(),
		status: "draft",
		imageS3Key: "",
		tags: [],
	});

	const editor = useEditor({
		extensions: [StarterKit, LinkExtension, ImageExtension],
		content: formData.content || "",
		onUpdate: ({ editor }) => {
			const html = editor.getHTML();
			const text = editor.getText();
			const excerpt = text.slice(0, 500);
			setFormData({ ...formData, content: html, excerpt });
		},
	});

	useEffect(() => {
		if (editor && formData.content !== editor.getHTML()) {
			editor.commands.setContent(formData.content || "");
		}
	}, [formData.content, editor]);

	const handleDateChange = (value: string | null) => {
		setFormData({ ...formData, publishedDate: value || new Date().toISOString() });
	};

	const { data: news, isLoading, refetch } = trpc.news.list.useQuery({ limit: 100 });
	const uploadMutation = trpc.upload.getPresignedUrl.useMutation();
	const createMutation = trpc.news.create.useMutation({
		onSuccess: () => {
			refetch();
			close();
			resetForm();
			setUploading(false);
			notifications.show({
				title: "Erfolg",
				message: "News-Artikel wurde erfolgreich erstellt",
				color: "green",
			});
		},
		onError: (error) => {
			setUploading(false);
			notifications.show({
				title: "Fehler",
				message: error.message || "News-Artikel konnte nicht erstellt werden",
				color: "red",
			});
		},
	});
	const updateMutation = trpc.news.update.useMutation({
		onSuccess: () => {
			refetch();
			close();
			resetForm();
			setUploading(false);
			notifications.show({
				message: "News-Artikel wurde aktualisiert",
				color: "green",
			});
		},
		onError: (error) => {
			setUploading(false);
			notifications.show({
				title: "Fehler",
				message: error.message || "News-Artikel konnte nicht aktualisiert werden",
				color: "red",
			});
		},
	});
	const deleteMutation = trpc.news.delete.useMutation({
		onSuccess: () => {
			refetch();
			notifications.show({
				title: "Erfolg",
				message: "News-Artikel wurde erfolgreich gelöscht",
				color: "green",
			});
		},
		onError: (error) => {
			notifications.show({
				title: "Fehler",
				message: error.message || "News-Artikel konnte nicht gelöscht werden",
				color: "red",
			});
		},
	});

	const resetForm = () => {
		setFormData({
			title: "",
			slug: "",
			content: "",
			excerpt: "",
			publishedDate: new Date().toISOString(),
			status: "draft",
			imageS3Key: "",
			tags: [],
		});
		editor?.commands.clearContent();
		setImageFile(null);
		setDeleteImage(false);
		setEditingId(null);
	};

	const handleSubmit = async () => {
		if (!formData.title || !formData.content) return;

		setUploading(true);
		try {
			let imageS3Key = formData.imageS3Key || "";

			// Handle image deletion
			if (deleteImage) {
				imageS3Key = "";
			}

			// Upload new image
			if (imageFile) {
				const { uploadUrl, key } = await uploadMutation.mutateAsync({
					filename: imageFile.name,
					contentType: imageFile.type,
					folder: "news",
				});

				const uploadResponse = await fetch(uploadUrl, {
					method: "PUT",
					body: imageFile,
					headers: {
						"Content-Type": imageFile.type,
					},
				});

				if (!uploadResponse.ok) {
					throw new Error("Bild-Upload fehlgeschlagen");
				}

				imageS3Key = key;
			}

			const slug = slugify(formData.title);
			const cleanedData = Object.fromEntries(Object.entries({ ...formData, slug, imageS3Key: imageS3Key || undefined }).filter(([_, value]) => value !== "" && value !== undefined));

			if (editingId) {
				updateMutation.mutate({
					id: editingId,
					data: cleanedData,
				});
			} else {
				createMutation.mutate(cleanedData as NewsInput);
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

	const handleEdit = (article: NewsInput & { id: string }) => {
		setFormData({
			title: article.title,
			slug: article.slug,
			content: article.content,
			excerpt: article.excerpt || "",
			publishedDate: article.publishedDate,
			status: article.status,
			imageS3Key: article.imageS3Key || "",
			tags: article.tags || [],
		});
		setImageFile(null);
		setDeleteImage(false);
		setEditingId(article.id);
		open();
	};

	const handleDelete = (id: string) => {
		if (window.confirm("Möchten Sie diesen News-Artikel wirklich löschen?")) {
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
				<Title order={2}>News</Title>
				<Button onClick={handleOpenNew}>Neuer Artikel</Button>
			</Group>

			<Modal opened={opened} onClose={close} title={editingId ? "News-Artikel bearbeiten" : "Neuer News-Artikel"} size="100%">
				<Stack gap="md">
					<TextInput label="Titel" placeholder="Artikeltitel" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
					<Box>
						<Text size="sm" fw={500} mb="xs">
							Inhalt{" "}
							<Text component="span" c="red">
								*
							</Text>
						</Text>
						<RichTextEditor editor={editor}>
							<RichTextEditor.Toolbar sticky stickyOffset={60}>
								<RichTextEditor.ControlsGroup>
									<RichTextEditor.Bold />
									<RichTextEditor.Italic />
									<RichTextEditor.Strikethrough />
									<RichTextEditor.ClearFormatting />
								</RichTextEditor.ControlsGroup>

								<RichTextEditor.ControlsGroup>
									<RichTextEditor.H1 />
									<RichTextEditor.H2 />
									<RichTextEditor.H3 />
								</RichTextEditor.ControlsGroup>

								<RichTextEditor.ControlsGroup>
									<RichTextEditor.Blockquote />
									<RichTextEditor.Hr />
									<RichTextEditor.BulletList />
									<RichTextEditor.OrderedList />
								</RichTextEditor.ControlsGroup>

								<RichTextEditor.ControlsGroup>
									<RichTextEditor.Link />
									<RichTextEditor.Unlink />
								</RichTextEditor.ControlsGroup>
							</RichTextEditor.Toolbar>

							<RichTextEditor.Content style={{ minHeight: 300 }} />
						</RichTextEditor>
					</Box>{" "}
					<Group grow>
						<Select
							label="Status"
							value={formData.status}
							onChange={(value) => setFormData({ ...formData, status: value as "draft" | "published" | "archived" })}
							data={[
								{ value: "draft", label: "Entwurf" },
								{ value: "published", label: "Veröffentlicht" },
								{ value: "archived", label: "Archiviert" },
							]}
							required
						/>
						<DateTimePicker label="Veröffentlichungsdatum" value={formData.publishedDate ? new Date(formData.publishedDate) : null} onChange={handleDateChange} required />
					</Group>
					{/* Image Upload */}
					<Box>
						<Text size="sm" fw={500} mb="xs">
							Titelbild
						</Text>

						{/* Existing image */}
						{formData.imageS3Key && !deleteImage && !imageFile && <ExistingImage s3Key={formData.imageS3Key} onDelete={() => setDeleteImage(true)} />}

						{/* Deleted image state */}
						{deleteImage && !imageFile && (
							<Card withBorder p="md" bg="red.0">
								<Group justify="space-between">
									<Group>
										<Trash2 size={24} style={{ color: "var(--mantine-color-red-6)" }} />
										<Text size="sm" c="red" fw={500}>
											Bild wird gelöscht
										</Text>
									</Group>
									<Button size="xs" variant="subtle" onClick={() => setDeleteImage(false)}>
										Rückgängig
									</Button>
								</Group>
							</Card>
						)}

						{/* New image preview */}
						{imageFile && (
							<Card withBorder p="md">
								<Group justify="space-between" align="flex-start">
									<Box style={{ flex: 1 }}>
										<Image src={URL.createObjectURL(imageFile)} height={200} fit="contain" alt="Vorschau" radius="sm" />
										<Text size="sm" c="dimmed" mt="xs">
											{imageFile.name}
										</Text>
									</Box>
									<ActionIcon color="red" variant="subtle" onClick={() => setImageFile(null)}>
										<X size={20} />
									</ActionIcon>
								</Group>
							</Card>
						)}

						{/* Dropzone */}
						{!imageFile && (!formData.imageS3Key || deleteImage) && (
							<Dropzone onDrop={(files) => setImageFile(files[0])} accept={IMAGE_MIME_TYPE} maxSize={5 * 1024 * 1024} maxFiles={1}>
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
											Bild hierher ziehen oder klicken zum Auswählen
										</Text>
										<Text size="sm" c="dimmed" inline mt={7}>
											Max. 5MB
										</Text>
									</div>
								</Group>
							</Dropzone>
						)}
					</Box>
					<Group justify="flex-end" mt="md">
						<Button variant="subtle" onClick={close}>
							Abbrechen
						</Button>
						<Button onClick={handleSubmit} loading={uploading || createMutation.isPending || updateMutation.isPending} disabled={!formData.title || !formData.content}>
							{editingId ? "Aktualisieren" : "Erstellen"}
						</Button>
					</Group>
				</Stack>
			</Modal>

			<Paper withBorder p="md">
				{isLoading ? (
					<Text>Laden...</Text>
				) : news && news.items.length > 0 ? (
					<Table striped highlightOnHover>
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Titel</Table.Th>
								<Table.Th>Status</Table.Th>
								<Table.Th>Veröffentlicht</Table.Th>
								<Table.Th>Bild</Table.Th>
								<Table.Th>Aktionen</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{news.items.map((article) => (
								<Table.Tr key={article.id}>
									<Table.Td>
										<Text fw={500}>{article.title}</Text>
										{article.excerpt && (
											<Text size="sm" c="dimmed" lineClamp={1}>
												{article.excerpt}
											</Text>
										)}
									</Table.Td>
									<Table.Td>
										<Badge color={article.status === "published" ? "green" : article.status === "draft" ? "yellow" : "gray"} variant="light">
											{article.status === "published" ? "Veröffentlicht" : article.status === "draft" ? "Entwurf" : "Archiviert"}
										</Badge>
									</Table.Td>
									<Table.Td>{dayjs(article.publishedDate).format("DD.MM.YYYY HH:mm")}</Table.Td>
									<Table.Td>{article.imageS3Key ? <Badge size="sm">✓</Badge> : "-"}</Table.Td>
									<Table.Td>
										<Group gap="xs">
											<Button size="xs" onClick={() => handleEdit(article)}>
												Bearbeiten
											</Button>
											<Button size="xs" color="red" onClick={() => handleDelete(article.id)} loading={deleteMutation.isPending}>
												Löschen
											</Button>
										</Group>
									</Table.Td>
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
				) : (
					<Text>Keine News-Artikel vorhanden</Text>
				)}
			</Paper>
		</Stack>
	);
}

function ExistingImage({ s3Key, onDelete }: { s3Key: string; onDelete: () => void }) {
	const { data: imageUrl } = trpc.upload.getFileUrl.useQuery({ s3Key }, { enabled: !!s3Key });

	return (
		<Card withBorder p="md">
			<Group justify="space-between" align="flex-start">
				<Box style={{ flex: 1 }}>
					{imageUrl ? (
						<Image src={imageUrl} height={200} fit="contain" alt="Aktuelles Bild" radius="sm" />
					) : (
						<Box h={200} bg="gray.1" style={{ display: "flex", alignItems: "center", justifyContent: "center" }} />
					)}
				</Box>
				<ActionIcon color="red" variant="subtle" onClick={onDelete}>
					<Trash2 size={20} />
				</ActionIcon>
			</Group>
		</Card>
	);
}

export const Route = createFileRoute("/dashboard/news")({
	component: NewsPage,
});
