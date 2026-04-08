import { ActionIcon, Badge, Box, Button, Card, Group, Modal, Radio, SimpleGrid, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { useForm } from "@tanstack/react-form-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useNotification } from "@webapp/hooks/useNotification";
import { adminUsersGuard } from "@webapp/lib/auth-guards";
import { createUserFn, deleteUserFn, listUsersFn, updateUserFn } from "@webapp/server/functions/users";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

type UserRole = "Admin" | "Moderator";

const defaultCreateFormValues = {
	email: "",
	givenName: "",
	familyName: "",
	role: "Moderator" as UserRole,
};

const defaultEditFormValues = {
	email: "",
	givenName: "",
	familyName: "",
	role: "Moderator" as UserRole,
};

export const Route = createFileRoute("/admin/_layout/users")({
	beforeLoad: ({ context }) => {
		// Auth is guaranteed by the /admin/_layout parent route.
		// Only an additional role check is needed here.
		return adminUsersGuard(context.user);
	},
	component: UsersPage,
});

function UsersPage() {
	const isMobile = useMediaQuery("(max-width: 48em)");
	const notification = useNotification();
	const { currentUser } = Route.useRouteContext();
	const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
	const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
	const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

	const { data: users = [], refetch } = useQuery({ queryKey: ["users", "list"], queryFn: () => listUsersFn() });
	const createMutation = useMutation({
		mutationFn: (data: Parameters<typeof createUserFn>[0]["data"]) => createUserFn({ data }),
		onSuccess: () => refetch(),
	});
	const updateMutation = useMutation({
		mutationFn: (data: Parameters<typeof updateUserFn>[0]["data"]) => updateUserFn({ data }),
		onSuccess: () => refetch(),
	});
	const deleteMutation = useMutation({
		mutationFn: (data: Parameters<typeof deleteUserFn>[0]["data"]) => deleteUserFn({ data }),
		onSuccess: () => refetch(),
	});
	const createForm = useForm({
		defaultValues: defaultCreateFormValues,
		onSubmit: async ({ value }) => {
			if (!value.email || !value.givenName || !value.familyName) return;

			try {
				await createMutation.mutateAsync({
					email: value.email,
					givenName: value.givenName,
					familyName: value.familyName,
					role: value.role,
				});
				notification.success(`${value.givenName} ${value.familyName} wurde eingeladen`);
				createForm.reset();
				closeCreate();
			} catch (error) {
				notification.error({ title: "Fehler beim Erstellen", message: error instanceof Error ? error.message : "Ein Fehler ist aufgetreten" });
			}
		},
	});
	const editForm = useForm({
		defaultValues: defaultEditFormValues,
		onSubmit: async ({ value }) => {
			if (!value.email || !value.givenName || !value.familyName) return;

			try {
				await updateMutation.mutateAsync({
					email: value.email,
					givenName: value.givenName,
					familyName: value.familyName,
					role: value.role,
				});
				notification.success("Benutzerdaten aktualisiert");
				editForm.reset();
				closeEdit();
			} catch (error) {
				notification.error({ title: "Fehler beim Aktualisieren", message: error instanceof Error ? error.message : "Ein Fehler ist aufgetreten" });
			}
		},
	});
	const editingEmail = editForm.getFieldValue("email");

	const handleOpenEdit = (user: { email: string; givenName: string; familyName: string; groups: string[] }) => {
		editForm.setFieldValue("email", user.email);
		editForm.setFieldValue("givenName", user.givenName);
		editForm.setFieldValue("familyName", user.familyName);
		editForm.setFieldValue("role", (user.groups[0] || "Moderator") as UserRole);
		openEdit();
	};

	const handleDelete = async (email: string) => {
		try {
			await deleteMutation.mutateAsync({ email });
			notification.neutral({ title: email, message: "Das Benutzerkonto wurde gelöscht" });
			setDeleteTarget(null);
			closeEdit();
		} catch (error) {
			notification.error({ title: "Fehler beim Löschen", message: error instanceof Error ? error.message : "Ein Fehler ist aufgetreten" });
		}
	};

	return (
		<Stack gap="md">
			<Group justify="space-between">
				<Title order={2}>Benutzerverwaltung</Title>
				<Button leftSection={<Plus size={16} />} onClick={openCreate} visibleFrom="sm">
					Benutzer erstellen
				</Button>
				<ActionIcon onClick={openCreate} hiddenFrom="sm" variant="filled" radius="xl">
					<Plus size={20} />
				</ActionIcon>
			</Group>

			<Card withBorder bg="white" p={0} radius="md" visibleFrom="sm">
				<Table striped highlightOnHover horizontalSpacing="md">
					<Table.Thead>
						<Table.Tr>
							<Table.Th>E-Mail</Table.Th>
							<Table.Th>Name</Table.Th>
							<Table.Th>Rolle</Table.Th>
							<Table.Th>Erstellt</Table.Th>
							<Table.Th>Aktionen</Table.Th>
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{users.map((user) => {
							const role = user.groups[0] || "Moderator";

							return (
								<Table.Tr key={user.email}>
									<Table.Td>{user.email}</Table.Td>
									<Table.Td>
										{user.givenName} {user.familyName}
									</Table.Td>
									<Table.Td>
										<Badge size="md" variant="light" color={role === "Admin" ? "red" : "blumine"}>
											{role}
										</Badge>
									</Table.Td>
									<Table.Td>{new Date(user.created).toLocaleDateString("de-DE")}</Table.Td>
									<Table.Td>
										<Button visibleFrom="sm" size="xs" onClick={() => handleOpenEdit(user)}>
											Bearbeiten
										</Button>
									</Table.Td>
								</Table.Tr>
							);
						})}
					</Table.Tbody>
				</Table>
			</Card>

			<SimpleGrid cols={{ base: 1, sm: 1 }} spacing="md" hiddenFrom="sm">
				{users.map((user) => {
					const role = user.groups[0] || "Moderator";

					return (
						<Card key={user.email} shadow="sm" p="md" radius="md" withBorder>
							<Stack gap="xs">
								<Group justify="space-between" align="flex-start">
									<Stack gap={4} flex={1}>
										<Title order={4}>
											{user.givenName} {user.familyName}
										</Title>
										<Text size="sm" c="dimmed">
											{user.email}
										</Text>
									</Stack>
									<ActionIcon color="blumine" variant="filled" onClick={() => handleOpenEdit(user)} title="Benutzer bearbeiten" radius="xl">
										<Pencil size={16} />
									</ActionIcon>
								</Group>
								<Badge size="md" variant="light" color={role === "Admin" ? "red" : "blumine"}>
									{role}
								</Badge>
							</Stack>
						</Card>
					);
				})}
			</SimpleGrid>

			{/* Create User Modal */}
			<Modal opened={createOpened} onClose={closeCreate} title="Neuen Benutzer erstellen" size={isMobile ? "100%" : "md"} fullScreen={isMobile}>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						void createForm.handleSubmit();
					}}
				>
					<Stack gap="md">
						<createForm.Field name="email">
							{(field) => <TextInput label="E-Mail" placeholder={`person@example.com`} required value={field.state.value} onChange={(e) => field.handleChange(e.currentTarget.value)} />}
						</createForm.Field>
						<createForm.Field name="givenName">
							{(field) => <TextInput label="Vorname" placeholder="Erika" required value={field.state.value} onChange={(e) => field.handleChange(e.currentTarget.value)} />}
						</createForm.Field>
						<createForm.Field name="familyName">
							{(field) => <TextInput label="Nachname" placeholder="Mustermann" required value={field.state.value} onChange={(e) => field.handleChange(e.currentTarget.value)} />}
						</createForm.Field>
						<createForm.Field name="role">
							{(field) => (
								<Radio.Group label="Rolle" required value={field.state.value} onChange={(value) => field.handleChange(value as UserRole)}>
									<Stack gap="xs">
										<Radio value="Admin" label="Admin (voller Zugriff)" />
										<Radio value="Moderator" label="Moderator (nur Inhalte)" />
									</Stack>
								</Radio.Group>
							)}
						</createForm.Field>
						<Text size="sm" c="dimmed">
							Eine Einladungs-E-Mail mit temporären Zugangsdaten wird an den Benutzer gesendet.
						</Text>
						<Group justify="flex-end" gap="sm">
							<Button variant="subtle" type="button" onClick={closeCreate}>
								Abbrechen
							</Button>
							<Button type="submit" loading={createMutation.isPending}>
								Benutzer erstellen
							</Button>
						</Group>
					</Stack>
				</form>
			</Modal>

			{/* Edit User Modal */}
			<Modal opened={editOpened} onClose={closeEdit} title="Benutzer bearbeiten" size={isMobile ? "100%" : "md"} fullScreen={isMobile}>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						void editForm.handleSubmit();
					}}
				>
					<Stack gap="md">
						<editForm.Field name="givenName">
							{(field) => <TextInput label="Vorname" placeholder="Max" required value={field.state.value} onChange={(e) => field.handleChange(e.currentTarget.value)} />}
						</editForm.Field>
						<editForm.Field name="familyName">
							{(field) => <TextInput label="Nachname" placeholder="Mustermann" required value={field.state.value} onChange={(e) => field.handleChange(e.currentTarget.value)} />}
						</editForm.Field>
						<editForm.Field name="role">
							{(field) => (
								<Radio.Group label="Rolle" required value={field.state.value} onChange={(value) => field.handleChange(value as UserRole)}>
									<Stack gap="xs">
										<Radio value="Admin" label="Admin (voller Zugriff)" />
										<Radio value="Moderator" label="Moderator (nur Inhalte)" />
									</Stack>
								</Radio.Group>
							)}
						</editForm.Field>
						<Group justify="space-between">
							{editingEmail && currentUser?.email !== editingEmail ? (
								<ActionIcon color="red" variant="light" onClick={() => setDeleteTarget(editingEmail)} loading={deleteMutation.isPending} title="Benutzer dauerhaft löschen" radius="xl" size="lg">
									<Trash2 size={20} />
								</ActionIcon>
							) : (
								<Box />
							)}
							<Group gap="sm">
								<Button variant="light" type="button" onClick={closeEdit}>
									Abbrechen
								</Button>
								<Button variant="filled" type="submit" loading={updateMutation.isPending}>
									Speichern
								</Button>
							</Group>
						</Group>
					</Stack>
				</form>
			</Modal>

			{/* Delete Confirmation Modal */}
			<Modal opened={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Benutzer löschen?" size="sm" centered>
				<Stack gap="md">
					<Text>Möchten Sie diesen Benutzer wirklich dauerhaft löschen? Diese Aktion kann nicht rückgängig gemacht werden.</Text>
					<Group justify="flex-end" gap="sm">
						<Button variant="light" onClick={() => setDeleteTarget(null)}>
							Abbrechen
						</Button>
						<Button color="red" variant="filled" onClick={() => deleteTarget && handleDelete(deleteTarget)} loading={deleteMutation.isPending}>
							Löschen
						</Button>
					</Group>
				</Stack>
			</Modal>
		</Stack>
	);
}
