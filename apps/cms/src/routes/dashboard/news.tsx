import type { NewsInput } from "@lib/db/schemas";
import { ActionIcon, Badge, Box, Button, Card, Flex, Group, Image, Modal, Paper, Pill, SegmentedControl, SimpleGrid, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { RichTextEditor } from "@mantine/tiptap";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Image as ImageExtension } from "@tiptap/extension-image";
import { Link as LinkExtension } from "@tiptap/extension-link";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import dayjs from "dayjs";
import { Plus, Search, SquarePen, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTRPC } from "@/apps/shared/lib/trpc-config";
import { useNotification } from "../../hooks/useNotification";

function NewsPage() {
	const trpc = useTRPC();
	const notification = useNotification();
	const isMobile = useMediaQuery("(max-width: 48em)");
	const [opened, { open, close }] = useDisclosure(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [imageFiles, setImageFiles] = useState<File[]>([]);
	const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
	const [uploading, setUploading] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft" | "archived">("all");
	const [searchOpen, setSearchOpen] = useState(false);
	const [formData, setFormData] = useState<Partial<NewsInput>>({
		title: "",
		content: "",
		excerpt: "",
		status: undefined,
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

	const { data: news, isLoading, refetch } = useQuery(trpc.news.list.queryOptions({ limit: 100 }));
	const uploadMutation = useMutation(trpc.upload.getPresignedUrl.mutationOptions());
	const createMutation = useMutation(
		trpc.news.create.mutationOptions({
			onSuccess: () => {
				refetch();
				close();
				resetForm();
				setUploading(false);
				notification.success("News-Artikel wurde erfolgreich erstellt");
			},
			onError: (error) => {
				setUploading(false);
				notification.error({ message: error.message || "News-Artikel konnte nicht erstellt werden" });
			},
		}),
	);
	const updateMutation = useMutation(
		trpc.news.update.mutationOptions({
			onSuccess: () => {
				refetch();
				close();
				resetForm();
				setUploading(false);
				notification.success("News-Artikel wurde aktualisiert");
			},
			onError: (error) => {
				setUploading(false);
				notification.error({ message: error.message || "News-Artikel konnte nicht aktualisiert werden" });
			},
		}),
	);
	const deleteMutation = useMutation(
		trpc.news.delete.mutationOptions({
			onSuccess: () => {
				refetch();
				close();
				resetForm();
				setEditingId(null);
				notification.success("News wurde erfolgreich gelöscht");
			},
			onError: (error) => {
				notification.error({ message: error.message || "News-Artikel konnte nicht gelöscht werden" });
			},
		}),
	);

	const resetForm = () => {
		setFormData({
			title: "",
			content: "",
			excerpt: "",
			status: undefined,
			imageS3Keys: [],
			tags: [],
		});
		editor?.commands.clearContent();
		setImageFiles([]);
		setImagesToDelete([]);
		setEditingId(null);
	};

	const handleSubmit = async (newStatus: "draft" | "published" | "archived") => {
		const { title, content } = formData;
		if (!title || !content) return;

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

			const submitData = {
				title,
				content,
				status: newStatus,
				excerpt: formData.excerpt || undefined,
				imageS3Keys: imageS3Keys.length > 0 ? imageS3Keys : undefined,
				tags: formData.tags && formData.tags.length > 0 ? formData.tags : undefined,
			};

			if (editingId) {
				updateMutation.mutate({
					id: editingId,
					data: submitData,
				});
			} else {
				createMutation.mutate(submitData);
			}
		} catch (error) {
			notification.error({ message: error instanceof Error ? error.message : "Ein Fehler ist aufgetreten" });
			setUploading(false);
		}
	};

	const handleEdit = (article: NewsInput & { id: string }) => {
		setFormData({
			title: article.title,
			content: article.content,
			excerpt: article.excerpt || "",
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
				<Button onClick={handleOpenNew} leftSection={<Plus />} visibleFrom="sm">
					Neuer Artikel
				</Button>
				<ActionIcon onClick={handleOpenNew} hiddenFrom="sm" variant="filled" radius="xl">
					<Plus size={20} />
				</ActionIcon>
			</Group>
			<Stack gap="xs" hiddenFrom="sm">
				{searchOpen ? (
					<Group>
						<TextInput placeholder="Artikel suchen..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ flex: 1 }} autoFocus />
						<ActionIcon variant="subtle" onClick={() => setSearchOpen(false)}>
							<X size={20} />
						</ActionIcon>
					</Group>
				) : (
					<Group justify="space-between">
						<ActionIcon variant="subtle" onClick={() => setSearchOpen(true)}>
							<Search size={20} />
						</ActionIcon>
						<SegmentedControl
							value={statusFilter}
							onChange={(value) => setStatusFilter(value as typeof statusFilter)}
							data={[
								{ label: "Alle", value: "all" },
								{ label: "Öffentlich", value: "published" },
								{ label: "Entwurf", value: "draft" },
								{ label: "Archiv", value: "archived" },
							]}
						/>
					</Group>
				)}
			</Stack>
			<Group visibleFrom="sm">
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

			<Modal opened={opened} onClose={close} title={editingId ? "News bearbeiten" : "News erstellen"} size="100%" fullScreen={isMobile}>
				<Stack gap="md" p={{ base: "md", sm: "sm" }}>
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
					</Box>

					{/* Image Gallery Upload */}
					<Box>
						{formData.imageS3Keys && formData.imageS3Keys.length > 0 && (
							<Stack gap={0}>
								<Text size="sm" fw={500} mb="xs">
									Bildergalerie
								</Text>
								<Text size="xs" c="dimmed" mb="sm">
									Ein zufälliges Bild wird als Vorschaubild auf der News-Seite verwendet.
								</Text>
							</Stack>
						)}

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
						<Dropzone onDrop={(files) => setImageFiles([...imageFiles, ...files])} accept={IMAGE_MIME_TYPE} maxSize={5 * 1024 * 1024} bd="1px dashed var(--mantine-color-dimmed)" p="xs">
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
										Bilder hierher ziehen oder klicken zum Auswählen
									</Text>
									<Text size="sm" c="dimmed" inline mt={7}>
										Mehrere Bilder möglich, max. 5MB pro Bild
									</Text>
									<Text size="xs" c="dimmed" mt="xs">
										{(formData.imageS3Keys?.length || 0) - imagesToDelete.length + imageFiles.length} Bild
										{(formData.imageS3Keys?.length || 0) - imagesToDelete.length + imageFiles.length !== 1 ? "er" : ""}
									</Text>
								</Stack>
							</Flex>
						</Dropzone>
					</Box>

					<Group justify="space-between" align="flex-end" wrap="nowrap">
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
						<Group gap="xs" justify="flex-end" align="flex-end" wrap="nowrap">
							{(formData.status === "draft" || !formData.status) && (
								<Button
									variant="light"
									onClick={() => handleSubmit("draft")}
									loading={uploading || createMutation.isPending || updateMutation.isPending}
									disabled={!formData.title || !formData.content}
								>
									Speichern
								</Button>
							)}

							{(formData.status === "draft" || formData.status === "published") && (
								<Button
									variant="light"
									onClick={() => handleSubmit("archived")}
									loading={uploading || createMutation.isPending || updateMutation.isPending}
									disabled={!formData.title || !formData.content}
								>
									Archivieren
								</Button>
							)}

							<Button
								variant="filled"
								onClick={() => handleSubmit("published")}
								loading={uploading || createMutation.isPending || updateMutation.isPending}
								disabled={!formData.title || !formData.content}
							>
								{formData.status !== "published" ? "Veröffentlichen" : "Aktualisieren"}
							</Button>
						</Group>
					</Group>
				</Stack>
			</Modal>

			<Paper withBorder p="md">
				{isLoading ? (
					<Text>Laden...</Text>
				) : filteredNews.length > 0 ? (
					<>
						<Table striped highlightOnHover visibleFrom="sm">
							<Table.Thead>
								<Table.Tr>
									<Table.Th style={{ width: "100%" }}>Titel</Table.Th>
									<Table.Th style={{ whiteSpace: "nowrap" }}>Status</Table.Th>
									<Table.Th style={{ whiteSpace: "nowrap" }}>Aktualisiert</Table.Th>
									<Table.Th style={{ whiteSpace: "nowrap" }}>Bilder</Table.Th>
									<Table.Th style={{ whiteSpace: "nowrap" }}>Aktionen</Table.Th>
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{filteredNews.map((article) => (
									<Table.Tr key={article.id} data-news-id={article.id}>
										<Table.Td style={{ width: "100%" }}>
											<Text fw={500}>{article.title}</Text>
											{article.excerpt && (
												<Text size="sm" c="dimmed" lineClamp={1}>
													{article.excerpt}
												</Text>
											)}
										</Table.Td>
										<Table.Td style={{ whiteSpace: "nowrap" }}>
											<Pill color={article.status === "published" ? "green" : article.status === "draft" ? "yellow" : "gray"}>
												{article.status === "published" ? "Veröffentlicht" : article.status === "draft" ? "Entwurf" : "Archiviert"}
											</Pill>
										</Table.Td>
										<Table.Td style={{ whiteSpace: "nowrap" }}>{dayjs(article.updatedAt).format("DD.MM.YYYY")}</Table.Td>
										<Table.Td align="center" style={{ whiteSpace: "nowrap" }}>
											<Badge size="md" variant="light">
												{article.imageS3Keys?.length || 0}
											</Badge>
										</Table.Td>
										<Table.Td style={{ whiteSpace: "nowrap" }}>
											<Button visibleFrom="sm" size="xs" onClick={() => handleEdit(article)}>
												Bearbeiten
											</Button>
											<ActionIcon hiddenFrom="sm" variant="filled" radius="xl" onClick={() => handleEdit(article)}>
												<SquarePen size={16} />
											</ActionIcon>
										</Table.Td>
									</Table.Tr>
								))}
							</Table.Tbody>
						</Table>

						<SimpleGrid cols={{ base: 1, sm: 1 }} spacing="md" hiddenFrom="sm">
							{filteredNews.map((article) => (
								<Card key={article.id} shadow="sm" p="md" radius="md" withBorder>
									<Stack gap="xs">
										<Group justify="space-between" align="flex-start">
											<Stack gap={4} flex={1}>
												<Title order={4}>{article.title}</Title>
												{article.excerpt && (
													<Text size="sm" c="dimmed" lineClamp={2}>
														{article.excerpt}
													</Text>
												)}
											</Stack>
											<ActionIcon color="blumine" variant="filled" onClick={() => handleEdit(article)} radius="xl">
												<SquarePen size={16} />
											</ActionIcon>
										</Group>
										<Group justify="space-between">
											<Pill color={article.status === "published" ? "green" : article.status === "draft" ? "yellow" : "gray"}>
												{article.status === "published" ? "Veröffentlicht" : article.status === "draft" ? "Entwurf" : "Archiviert"}
											</Pill>
											{article.imageS3Keys && article.imageS3Keys?.length > 1 && (
												<Badge size="md" variant="light">
													{article.imageS3Keys.length} Bilder
												</Badge>
											)}
										</Group>
									</Stack>
								</Card>
							))}
						</SimpleGrid>

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
	const trpc = useTRPC();
	const { data: imageUrl } = useQuery(trpc.upload.getFileUrl.queryOptions({ s3Key }, { enabled: !!s3Key && !isDeleted }));

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
