import type { NewsInput } from "@lib/db/schemas";
import { ActionIcon, Badge, Box, Button, Card, Group, Image, Modal, Paper, SegmentedControl, Select, Stack, Table, Text, TextInput, Title } from "@mantine/core";
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
import { useEffect, useMemo, useState } from "react";
import { trpc } from "../../lib/trpc";

function NewsPage() {
	const [opened, { open, close }] = useDisclosure(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [imageFiles, setImageFiles] = useState<File[]>([]);
	const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
	const [uploading, setUploading] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft" | "archived">("all");
	const [formData, setFormData] = useState<Partial<NewsInput>>({
		title: "",
		slug: "",
		content: "",
		excerpt: "",
		publishedDate: new Date().toISOString(),
		status: "draft",
		imageS3Keys: [],
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
			imageS3Keys: [],
			tags: [],
		});
		editor?.commands.clearContent();
		setImageFiles([]);
		setImagesToDelete([]);
		setEditingId(null);
	};

	const handleSubmit = async () => {
		if (!formData.title || !formData.content) return;

		setUploading(true);
		try {
			// Start with existing images, removing the ones marked for deletion
			let imageS3Keys = (formData.imageS3Keys || []).filter((key) => !imagesToDelete.includes(key));

			// Upload new images
			if (imageFiles.length > 0) {
				const uploadPromises = imageFiles.map(async (file) => {
					const { uploadUrl, key } = await uploadMutation.mutateAsync({
						filename: file.name,
						contentType: file.type,
						folder: "news",
					});

					const uploadResponse = await fetch(uploadUrl, {
						method: "PUT",
						body: file,
						headers: {
							"Content-Type": file.type,
						},
					});

					if (!uploadResponse.ok) {
						throw new Error(`Bild-Upload fehlgeschlagen: ${file.name}`);
					}

					return key;
				});

				const newKeys = await Promise.all(uploadPromises);
				imageS3Keys = [...imageS3Keys, ...newKeys];
			}

			const slug = slugify(formData.title);
			const cleanedData = Object.fromEntries(
				Object.entries({ ...formData, slug, imageS3Keys: imageS3Keys.length > 0 ? imageS3Keys : undefined }).filter(([_, value]) => value !== "" && value !== undefined),
			);

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
			imageS3Keys: article.imageS3Keys || [],
			tags: article.tags || [],
		});
		setImageFiles([]);
		setImagesToDelete([]);
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

	// Filter news based on search and status
	const filteredNews = useMemo(() => {
		if (!news?.items) return [];

		return news.items.filter((article) => {
			// Status filter
			if (statusFilter !== "all" && article.status !== statusFilter) {
				return false;
			}

			// Search filter
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				return article.title.toLowerCase().includes(query) || article.excerpt?.toLowerCase().includes(query);
			}

			return true;
		});
	}, [news?.items, searchQuery, statusFilter]);

	return (
		<Stack gap="md">
			<Group justify="space-between">
				<Title order={2}>News</Title>
				<Button onClick={handleOpenNew}>Neuer Artikel</Button>
			</Group>

			<Group>
				<TextInput placeholder="Artikel suchen..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ flex: 1 }} />
				<SegmentedControl
					value={statusFilter}
					onChange={(value) => setStatusFilter(value as typeof statusFilter)}
					data={[
						{ label: "Alle", value: "all" },
						{ label: "Veröffentlicht", value: "published" },
						{ label: "Entwurf", value: "draft" },
						{ label: "Archiviert", value: "archived" },
					]}
				/>
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
					{/* Image Gallery Upload */}
					<Box>
						<Text size="sm" fw={500} mb="xs">
							Bildergalerie
						</Text>
						<Text size="xs" c="dimmed" mb="sm">
							Ein zufälliges Bild wird als Vorschaubild auf der News-Seite verwendet.
						</Text>

						{/* Existing images */}
						{formData.imageS3Keys && formData.imageS3Keys.length > 0 && (
							<Group gap="sm" mb="md">
								{formData.imageS3Keys.map((s3Key) => (
									<ExistingImage
										key={s3Key}
										s3Key={s3Key}
										isDeleted={imagesToDelete.includes(s3Key)}
										onDelete={() => setImagesToDelete([...imagesToDelete, s3Key])}
										onRestore={() => setImagesToDelete(imagesToDelete.filter((k) => k !== s3Key))}
									/>
								))}
							</Group>
						)}

						{/* New image previews */}
						{imageFiles.length > 0 && (
							<Group gap="sm" mb="md">
								{imageFiles.map((file, index) => {
									const previewUrl = URL.createObjectURL(file);
									return (
										<Card key={`${file.name}-${index}`} withBorder p="xs" pos="relative" w={120}>
											<ActionIcon pos="absolute" top={4} right={4} size="sm" variant="filled" color="red" onClick={() => setImageFiles(imageFiles.filter((_, i) => i !== index))} style={{ zIndex: 1 }}>
												<X size={14} />
											</ActionIcon>
											<Image src={previewUrl} height={100} fit="cover" alt={file.name} radius="sm" />
											<Text size="xs" c="dimmed" mt="xs" lineClamp={1} ta="center">
												{file.name}
											</Text>
										</Card>
									);
								})}
							</Group>
						)}

						{/* Dropzone - always visible for adding more images */}
						<Dropzone onDrop={(files) => setImageFiles([...imageFiles, ...files])} accept={IMAGE_MIME_TYPE} maxSize={5 * 1024 * 1024}>
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
										{(formData.imageS3Keys?.length || 0) - imagesToDelete.length + imageFiles.length} Bild
										{(formData.imageS3Keys?.length || 0) - imagesToDelete.length + imageFiles.length !== 1 ? "er" : ""}
									</Text>
								</div>
							</Group>
						</Dropzone>
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
				) : filteredNews.length > 0 ? (
					<>
						<Table striped highlightOnHover>
							<Table.Thead>
								<Table.Tr>
									<Table.Th>Titel</Table.Th>
									<Table.Th>Status</Table.Th>
									<Table.Th>Veröffentlicht</Table.Th>
									<Table.Th>Bilder</Table.Th>
									<Table.Th>Aktionen</Table.Th>
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{filteredNews.map((article) => (
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
										<Table.Td>
											<Badge size="sm">{article.imageS3Keys?.length || 0}</Badge>
										</Table.Td>
										<Table.Td>
											<Group gap="xs">
												<Button size="xs" onClick={() => handleEdit(article)}>
													Bearbeiten
												</Button>
												<ActionIcon variant="light" radius="xl" color="red" onClick={() => handleDelete(article.id)} loading={deleteMutation.isPending}>
													<Trash2 size={16} />
												</ActionIcon>
											</Group>
										</Table.Td>
									</Table.Tr>
								))}
							</Table.Tbody>
						</Table>
						{searchQuery || statusFilter !== "all" ? (
							<Text size="sm" c="dimmed" mt="md">
								{filteredNews.length} von {news?.items.length || 0} Artikel{filteredNews.length !== 1 ? "n" : ""}
							</Text>
						) : null}
					</>
				) : (
					<Text c="dimmed" ta="center" py="xl">
						{searchQuery || statusFilter !== "all" ? "Keine passenden Artikel gefunden" : "Keine News-Artikel vorhanden"}
					</Text>
				)}
			</Paper>
		</Stack>
	);
}

function ExistingImage({ s3Key, isDeleted, onDelete, onRestore }: { s3Key: string; isDeleted: boolean; onDelete: () => void; onRestore: () => void }) {
	const { data: imageUrl } = trpc.upload.getFileUrl.useQuery({ s3Key }, { enabled: !!s3Key && !isDeleted });

	if (isDeleted) {
		return (
			<Card withBorder p="xs" bg="red.0" pos="relative" w={120}>
				<Box h={100} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
					<Stack gap="xs" align="center">
						<Trash2 size={24} style={{ color: "var(--mantine-color-red-6)" }} />
						<Text size="xs" c="red" fw={500}>
							Wird gelöscht
						</Text>
					</Stack>
				</Box>
				<Button size="xs" variant="subtle" fullWidth mt="xs" onClick={onRestore}>
					Rückgängig
				</Button>
			</Card>
		);
	}

	return (
		<Card withBorder p="xs" pos="relative" w={120}>
			<ActionIcon pos="absolute" top={4} right={4} size="sm" variant="filled" color="red" onClick={onDelete} style={{ zIndex: 1 }}>
				<Trash2 size={14} />
			</ActionIcon>
			{imageUrl ? <Image src={imageUrl} height={100} fit="cover" alt="Bild" radius="sm" /> : <Box h={100} bg="gray.1" style={{ display: "flex", alignItems: "center", justifyContent: "center" }} />}
		</Card>
	);
}

export const Route = createFileRoute("/dashboard/news")({
	component: NewsPage,
});
