import type { MemberInput } from "@lib/db/schemas";
import { ActionIcon, Badge, Box, Button, Card, Checkbox, Flex, Group, Image, Modal, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { useForm } from "@tanstack/react-form-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MAX_UPLOAD_SIZE } from "@utils/image-config";
import { useNotification } from "@webapp/hooks/useNotification";
import { formatProxyAlias, getProxyAliasDomain, parseProxyAlias } from "@webapp/server/functions/member-alias";
import { adminListMembersFn, checkProxyEmailFn, createMemberFn, deleteMemberFn, listMembersFn, suggestProxyAliasFn, updateMemberFn } from "@webapp/server/functions/members";
import { getFileUrlFn, getPresignedUrlFn } from "@webapp/server/functions/upload";
import { Pencil, Plus, Trash2, Upload, User, X } from "lucide-react";
import { useState } from "react";
import z from "zod";

const bytesToMB = (bytes: number, decimals = 1) => (bytes / (1024 * 1024)).toFixed(decimals);
const isValidEmail = (value: string) => z.email().safeParse(value).success;
const defaultProxyAliasDomain = getProxyAliasDomain(import.meta.env.CDK_ENVIRONMENT);
const branchNameFromEnv = (import.meta.env as Record<string, string | undefined>).VITE_BRANCH_NAME;

const getProxyAliasInputParts = (proxyEmail?: string) => {
	if (!proxyEmail) {
		return {
			domain: defaultProxyAliasDomain,
			baseLocalPart: "",
			branchName: branchNameFromEnv,
		};
	}

	const parsed = parseProxyAlias(proxyEmail, defaultProxyAliasDomain);

	return {
		domain: parsed.domain,
		baseLocalPart: parsed.baseLocalPart,
		branchName: branchNameFromEnv || parsed.branchName,
	};
};

const resolveFileUrl = async (s3Key?: string) => {
	if (!s3Key) return null;
	return (await getFileUrlFn({ data: { s3Key } })) ?? null;
};

function CurrentAvatarDisplay({
	avatarS3Key,
	avatarFile,
	deleteAvatar,
	onFileChange,
	onDeleteToggle,
	onFileSizeError,
}: {
	avatarS3Key?: string;
	avatarFile: File | null;
	deleteAvatar: boolean;
	onFileChange: (file: File | null) => void;
	onDeleteToggle: () => void;
	onFileSizeError: (message: string) => void;
}) {
	const { data: avatarUrl } = useQuery({
		queryKey: ["upload", "fileUrl", avatarS3Key],
		queryFn: () => resolveFileUrl(avatarS3Key),
		enabled: !!avatarS3Key && !deleteAvatar,
	});

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
						if (file) {
							if (file.size > MAX_UPLOAD_SIZE) {
								onFileSizeError(`${file.name} ist zu groß (${bytesToMB(file.size)}MB). Maximum ${bytesToMB(MAX_UPLOAD_SIZE, 0)}MB.`);
								return;
							}
							onFileChange(file);
						}
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
				onDrop={(files: File[]) => {
					if (files.length > 0) {
						const file = files[0];
						if (file.size > MAX_UPLOAD_SIZE) {
							onFileSizeError(`${file.name} ist zu groß (${bytesToMB(file.size)}MB). Maximum ${bytesToMB(MAX_UPLOAD_SIZE, 0)}MB.`);
							return;
						}
						onFileChange(file);
					}
				}}
				accept={IMAGE_MIME_TYPE}
				maxSize={MAX_UPLOAD_SIZE}
				maxFiles={1}
				bd="1px dashed var(--mantine-color-dimmed)"
				p="xs"
			>
				<Flex direction={{ base: "row", md: "column" }} justify="center" align="center" rowGap="md" columnGap="md" mih={{ base: 80, md: 120 }} style={{ pointerEvents: "none" }}>
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
							JPG oder PNG, max. {bytesToMB(MAX_UPLOAD_SIZE, 0)}MB
						</Text>
					</Stack>
				</Flex>
			</Dropzone>
		</Box>
	);
}

const defaultFormValues = {
	id: undefined as string | undefined,
	name: "",
	privateEmail: "",
	proxyEmail: "",
	phone: "",
	isBoardMember: false,
	isTrainer: false,
	roleTitle: "",
	avatarS3Key: undefined as string | undefined,
};

type PublicMemberListItem = Awaited<ReturnType<typeof listMembersFn>>["items"][number];
type MemberListItem = PublicMemberListItem & { privateEmail?: string };

function MembersPage() {
	const isMobile = useMediaQuery("(max-width: 48em)");
	const [opened, { open, close }] = useDisclosure(false);
	const [avatarFile, setAvatarFile] = useState<File | null>(null);
	const [deleteAvatar, setDeleteAvatar] = useState(false);
	const queryClient = useQueryClient();
	const { currentUser } = Route.useRouteContext();
	const canManageMembers = currentUser.role === "Admin";

	const notification = useNotification();
	const {
		data: members,
		isLoading,
		refetch,
	} = useQuery({
		queryKey: ["members", "list", canManageMembers ? "admin" : "public"],
		queryFn: () => (canManageMembers ? adminListMembersFn() : listMembersFn()),
	});

	const form = useForm({
		defaultValues: defaultFormValues,
		validators: {
			onChange: ({ value }) => {
				const hasProxyEmail = Boolean(value.proxyEmail);
				const hasPrivateEmail = Boolean(value.privateEmail);
				const privateEmailIsValid = !value.privateEmail || isValidEmail(value.privateEmail);
				const proxyEmailIsValid = !value.proxyEmail || isValidEmail(value.proxyEmail);

				const fieldErrors: Partial<Record<keyof typeof defaultFormValues, string>> = {};

				if (!privateEmailIsValid) {
					fieldErrors.privateEmail = "Bitte eine gültige E-Mail eingeben";
				}

				if (!proxyEmailIsValid) {
					fieldErrors.proxyEmail = "Bitte eine gültige E-Mail eingeben";
				}

				if (hasProxyEmail && !hasPrivateEmail) {
					fieldErrors.privateEmail = "Private E-Mail erforderlich";
				}

				if (Object.keys(fieldErrors).length === 0) {
					return undefined;
				}

				return { fields: fieldErrors };
			},
		},
		onSubmit: async ({ value }) => {
			if (!canManageMembers) {
				notification.error("Keine Berechtigung zum Bearbeiten von Mitgliedern");
				return;
			}

			const currentEditingId = value.id;
			let avatarS3Key: string | null | undefined = value.avatarS3Key;

			// Handle avatar deletion
			if (deleteAvatar) {
				avatarS3Key = null; // null tells the server to remove this attribute
			}
			// Upload new avatar if a file was selected
			else if (avatarFile) {
				const { uploadUrl, key } = await getPresignedUrlFn({
					data: { filename: avatarFile.name, contentType: avatarFile.type, folder: "members" },
				});

				// Upload file to S3
				const uploadResponse = await fetch(uploadUrl, {
					method: "PUT",
					body: avatarFile,
					headers: { "Content-Type": avatarFile.type },
				});

				if (!uploadResponse.ok) {
					throw new Error("Datei-Upload fehlgeschlagen");
				}

				avatarS3Key = key;
			}

			// Filter out empty strings to avoid DynamoDB GSI errors.
			// When editing, convert empty optional string fields to null so they can be cleared.
			const clearableOptionalFields = new Set(["privateEmail", "proxyEmail", "phone", "roleTitle"]);
			const cleanedData: Record<string, unknown> = {};
			for (const [key, val] of Object.entries({ ...value, avatarS3Key })) {
				if (key === "id") {
					continue;
				}

				if (key === "avatarS3Key") {
					cleanedData[key] = avatarS3Key; // always include (null for deletion, string for set, undefined for no change)
				} else if (currentEditingId && clearableOptionalFields.has(key) && val === "") {
					cleanedData[key] = null; // null signals the server to remove this attribute
				} else if (val !== "" && val !== undefined) {
					cleanedData[key] = val;
				}
			}

			try {
				if (currentEditingId) {
					await updateMemberFn({ data: { id: currentEditingId, data: cleanedData } });
					notification.success("Mitglied wurde aktualisiert");
				} else {
					await createMemberFn({ data: cleanedData as MemberInput });
					notification.success("Mitglied wurde erfolgreich erstellt");
				}
				void refetch();
				close();
				form.reset();
				setAvatarFile(null);
				setDeleteAvatar(false);
			} catch (error) {
				notification.error({
					message: error instanceof Error ? error.message : "Ein Fehler ist aufgetreten",
				});
			}
		},
	});
	const editingId = form.getFieldValue("id");

	const maybeSuggestAlias = async () => {
		if (!canManageMembers) {
			return;
		}

		const name = form.getFieldValue("name");
		const privateEmail = form.getFieldValue("privateEmail");
		const proxyEmail = form.getFieldValue("proxyEmail");
		const requestKey = `${name}|${privateEmail}`;

		if (!name || !isValidEmail(privateEmail) || proxyEmail) {
			return;
		}

		try {
			const alias = await queryClient.fetchQuery({
				queryKey: ["members", "suggestProxyAlias", name, privateEmail],
				queryFn: async () => {
					const { alias } = await suggestProxyAliasFn({ data: { name } });
					return alias;
				},
				staleTime: 5 * 60 * 1000,
			});

			const currentName = form.getFieldValue("name");
			const currentPrivateEmail = form.getFieldValue("privateEmail");
			const currentProxyEmail = form.getFieldValue("proxyEmail");
			if (`${currentName}|${currentPrivateEmail}` === requestKey && !currentProxyEmail) {
				form.setFieldValue("proxyEmail", alias);
			}
		} catch {
			// ignore
		}
	};

	const deleteMutation = useMutation({
		mutationFn: (data: Parameters<typeof deleteMemberFn>[0]["data"]) => deleteMemberFn({ data }),
		onSuccess: () => {
			void refetch();
			close();
			form.reset();
			setAvatarFile(null);
			setDeleteAvatar(false);
			notification.success("Mitglied wurde erfolgreich gelöscht");
		},
		onError: (error: unknown) => {
			notification.error({
				message: error instanceof Error ? error.message : "Mitglied konnte nicht gelöscht werden",
			});
		},
	});

	const handleEdit = (member: MemberListItem) => {
		if (!canManageMembers) {
			return;
		}

		form.setFieldValue("id", member.id);
		form.setFieldValue("name", member.name);
		form.setFieldValue("privateEmail", member.privateEmail ?? "");
		form.setFieldValue("proxyEmail", member.proxyEmail ?? "");
		form.setFieldValue("phone", member.phone ?? "");
		form.setFieldValue("isBoardMember", member.isBoardMember ?? false);
		form.setFieldValue("isTrainer", member.isTrainer ?? false);
		form.setFieldValue("roleTitle", member.roleTitle ?? "");
		form.setFieldValue("avatarS3Key", member.avatarS3Key);
		setDeleteAvatar(false);
		setAvatarFile(null);
		open();
	};

	const handleDelete = (id: string) => {
		if (!canManageMembers) {
			return;
		}

		if (window.confirm("Möchten Sie dieses Mitglied wirklich löschen?")) {
			deleteMutation.mutate({ id });
		}
	};

	const handleOpenNew = () => {
		if (!canManageMembers) {
			return;
		}

		form.reset();
		setDeleteAvatar(false);
		setAvatarFile(null);
		open();
	};

	return (
		<Stack gap="md">
			<Group justify="space-between">
				<Title order={2}>Mitglieder</Title>
				{canManageMembers && (
					<>
						<Button onClick={handleOpenNew} leftSection={<Plus />} visibleFrom="sm">
							Neues Mitglied
						</Button>
						<ActionIcon onClick={handleOpenNew} hiddenFrom="sm" variant="filled" radius="xl">
							<Plus size={20} />
						</ActionIcon>
					</>
				)}
			</Group>

			{canManageMembers && (
				<Modal opened={opened} onClose={close} title={editingId ? "Mitglied bearbeiten" : "Neues Mitglied"} size={isMobile ? "100%" : "lg"} fullScreen={isMobile}>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							void form.handleSubmit();
						}}
					>
						<Stack gap="md" p={{ base: "md", sm: "sm" }}>
							<form.Field
								name="name"
								listeners={{
									onChange: () => {
										void maybeSuggestAlias();
									},
									onChangeDebounceMs: 350,
								}}
								validators={{
									onChange: ({ value }) => (!value ? "Name ist erforderlich" : undefined),
								}}
							>
								{(field) => (
									<TextInput
										label="Name"
										placeholder="z.B. Max Mustermann"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={() => field.handleBlur()}
										error={field.state.meta.isTouched ? field.state.meta.errors[0] : undefined}
										required
									/>
								)}
							</form.Field>

							<form.Field
								name="privateEmail"
								listeners={{
									onChange: () => {
										void maybeSuggestAlias();
									},
									onChangeDebounceMs: 350,
								}}
								validators={{
									onChange: ({ value }) => {
										if (!value) return undefined;
										return isValidEmail(value) ? undefined : "Bitte eine gültige E-Mail eingeben";
									},
								}}
							>
								{(field) => (
									<TextInput
										label="Private E-Mail"
										placeholder="max.mustermann@gmail.com"
										type="email"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={() => field.handleBlur()}
										description="Wird nicht öffentlich angezeigt. Eingehende Mails werden hierhin weitergeleitet."
										error={field.state.meta.isTouched ? field.state.meta.errors[0] : undefined}
									/>
								)}
							</form.Field>

							<form.Subscribe selector={(state) => state.values.privateEmail}>
								{(privateEmail) =>
									isValidEmail(privateEmail) ? (
										<form.Field
											name="proxyEmail"
											validators={{
												onChange: ({ value }) => {
													if (!value) return undefined;
													return isValidEmail(value) ? undefined : "Bitte eine gültige E-Mail eingeben";
												},
												onChangeAsync: async ({ value }) => {
													if (!value) return undefined;
													if (!isValidEmail(value)) return undefined;
													try {
														const { available } = await checkProxyEmailFn({
															data: { proxyEmail: value, excludeMemberId: editingId ?? undefined },
														});
														return available ? undefined : "Alias bereits vergeben";
													} catch {
														return undefined;
													}
												},
												onChangeAsyncDebounceMs: 400,
											}}
										>
											{(field) =>
												(() => {
													const { domain, baseLocalPart, branchName } = getProxyAliasInputParts(field.state.value);
													const aliasSuffix = branchName ? `+${branchName}` : "";

													return (
														<TextInput
															label="Email Alias"
															placeholder="erika.mustermann"
															value={baseLocalPart}
															rightSection={
																<Text size="sm" c="dimmed" pr="xs" style={{ textWrap: "nowrap", pointerEvents: "none" }}>
																	{aliasSuffix}@{domain}
																</Text>
															}
															rightSectionWidth={"auto"}
															onChange={(e) => {
																const local = e.target.value;
																field.handleChange(local ? formatProxyAlias(local, domain, branchName) : "");
															}}
															onBlur={() => field.handleBlur()}
															description="Öffentliche Weiterleitung. Erscheint in Kontaktlinks auf der Website."
															error={field.state.meta.isTouched ? field.state.meta.errors[0] : undefined}
														/>
													);
												})()
											}
										</form.Field>
									) : null
								}
							</form.Subscribe>

							<form.Field name="phone">
								{(field) => <TextInput label="Telefon" placeholder="+49 123 456789" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />}
							</form.Field>

							<form.Field name="roleTitle">
								{(field) => <TextInput label="Funktion" placeholder="z.B. Abteilungsleiter" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />}
							</form.Field>

							<Group gap="md">
								<form.Field name="isBoardMember">{(field) => <Checkbox label="Board Member" checked={field.state.value} onChange={(e) => field.handleChange(e.currentTarget.checked)} />}</form.Field>
								<form.Field name="isTrainer">{(field) => <Checkbox label="Trainer" checked={field.state.value} onChange={(e) => field.handleChange(e.currentTarget.checked)} />}</form.Field>
							</Group>

							<form.Field name="avatarS3Key">
								{(field) => (
									<CurrentAvatarDisplay
										avatarS3Key={field.state.value}
										avatarFile={avatarFile}
										deleteAvatar={deleteAvatar}
										onFileChange={setAvatarFile}
										onDeleteToggle={() => {
											setDeleteAvatar(!deleteAvatar);
											setAvatarFile(null);
										}}
										onFileSizeError={(message) => {
											notification.error({ message });
										}}
									/>
								)}
							</form.Field>

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
								<Group gap="xs" ms="auto">
									<Button type="button" variant="light" onClick={close}>
										Abbrechen
									</Button>
									<form.Subscribe selector={(state) => ({ isSubmitting: state.isSubmitting, canSubmit: state.canSubmit })}>
										{({ isSubmitting, canSubmit }) => (
											<Button type="submit" variant="filled" loading={isSubmitting} disabled={!canSubmit}>
												{editingId ? "Aktualisieren" : "Erstellen"}
											</Button>
										)}
									</form.Subscribe>
								</Group>
							</Group>
						</Stack>
					</form>
				</Modal>
			)}

			{isLoading ? (
				<Text>Laden...</Text>
			) : members && members.items.length > 0 ? (
				<SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="md">
					{members.items
						.sort((a, b) => a.name.localeCompare(b.name))
						.map((member) => (
							<MemberCard key={member.id} member={member} onEdit={canManageMembers ? handleEdit : undefined} />
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

function MemberCard({ member, onEdit }: { member: MemberListItem; onEdit?: (member: MemberListItem) => void }) {
	const { data: avatarUrl } = useQuery({
		queryKey: ["upload", "fileUrl", member.avatarS3Key],
		queryFn: () => resolveFileUrl(member.avatarS3Key),
		enabled: !!member.avatarS3Key,
	});
	const hasDetails = Boolean(member.roleTitle || member.proxyEmail || member.phone);
	const hasBadges = member.isBoardMember || member.isTrainer;

	return (
		<Card shadow="sm" p="0" radius="md" withBorder h={{ base: "auto", sm: 188 }} style={{ overflow: "hidden" }}>
			<Box hiddenFrom="sm">
				<Flex align="flex-start" gap="sm" p="sm">
					<Box bg="gray.2" w={72} h={72} style={{ flexShrink: 0, overflow: "hidden", borderRadius: "var(--mantine-radius-sm)" }}>
						{avatarUrl ? (
							<Box component="img" src={avatarUrl} alt={member.name} h="100%" w="100%" style={{ display: "block", objectFit: "cover" }} />
						) : (
							<Flex justify="center" align="center" bg="gray.2" h="100%">
								<User size={36} style={{ color: "var(--mantine-color-gray-5)" }} />
							</Flex>
						)}
					</Box>
					<Flex direction="column" gap="xs" style={{ flex: 1, minWidth: 0 }}>
						<Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
							<Title order={4} lineClamp={2} style={{ flex: 1, minWidth: 0 }}>
								{member.name}
							</Title>

							{onEdit && (
								<ActionIcon variant="filled" radius="xl" size="lg" onClick={() => onEdit(member)} aria-label="Bearbeiten" style={{ flexShrink: 0 }}>
									<Pencil size={16} />
								</ActionIcon>
							)}
						</Group>

						{hasDetails && (
							<Stack gap={3}>
								{member.roleTitle && (
									<Text size="sm" fw={500} c="dimmed">
										{member.roleTitle}
									</Text>
								)}
								{member.proxyEmail && (
									<Text size="sm" c="dimmed" style={{ overflowWrap: "anywhere" }}>
										{member.proxyEmail}
									</Text>
								)}
								{member.phone && (
									<Text size="sm" c="dimmed">
										{member.phone}
									</Text>
								)}
							</Stack>
						)}

						{hasBadges && (
							<Group gap="xs" wrap="wrap" mt={4}>
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
					</Flex>
				</Flex>
			</Box>

			<Box visibleFrom="sm" h="100%">
				<Flex wrap="nowrap" align="stretch" h="100%">
					<Box bg="gray.2" h="100%" style={{ flex: "0 0 34%", minWidth: 96, maxWidth: 136, overflow: "hidden" }}>
						{avatarUrl ? (
							<Box component="img" src={avatarUrl} alt={member.name} h="100%" w="100%" style={{ display: "block", objectFit: "cover" }} />
						) : (
							<Flex justify="center" align="center" bg="gray.2" h="100%">
								<User size={60} style={{ color: "var(--mantine-color-gray-5)" }} />
							</Flex>
						)}
					</Box>
					<Flex direction="column" gap="sm" p="md" h="100%" style={{ flex: 1, minWidth: 0 }}>
						<Group justify="space-between" align="flex-start" wrap="nowrap">
							<Title order={4} lineClamp={2} style={{ flex: 1, minWidth: 0 }}>
								{member.name}
							</Title>

							{onEdit && (
								<ActionIcon variant="filled" radius="xl" onClick={() => onEdit(member)} aria-label="Bearbeiten">
									<Pencil size={16} />
								</ActionIcon>
							)}
						</Group>

						{hasDetails && (
							<Stack gap={4}>
								{member.roleTitle && (
									<Text size="sm" fw={500} c="dimmed" lineClamp={1}>
										{member.roleTitle}
									</Text>
								)}
								{member.proxyEmail && (
									<Text size="sm" c="dimmed" lineClamp={1} style={{ overflowWrap: "anywhere" }}>
										{member.proxyEmail}
									</Text>
								)}
								{member.phone && (
									<Text size="sm" c="dimmed" lineClamp={1}>
										{member.phone}
									</Text>
								)}
							</Stack>
						)}

						{hasBadges && (
							<Group gap="xs" wrap="wrap" mt="auto">
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
					</Flex>
				</Flex>
			</Box>
		</Card>
	);
}
export const Route = createFileRoute("/admin/_layout/members")({
	beforeLoad: ({ context }) => {
		return { currentUser: context.user };
	},
	component: MembersPage,
});
