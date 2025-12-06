import { ActionIcon, Badge, Box, Button, Card, Group, Modal, Radio, SimpleGrid, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTRPC } from "@/apps/shared/lib/trpc-config";
import { useAuth } from "../../auth/AuthContext";
import { useNotification } from "../../hooks/useNotification";

export const Route = createFileRoute("/dashboard/users")({
	component: UsersPage,
});

function UsersPage() {
	const isMobile = useMediaQuery("(max-width: 48em)");
	const trpc = useTRPC();
	const notification = useNotification();
	const { user: currentUser } = useAuth();
	const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
	const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
	const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
	const [editingEmail, setEditingEmail] = useState("");
	const [email, setEmail] = useState("");
	const [givenName, setGivenName] = useState("");
	const [familyName, setFamilyName] = useState("");
	const [role, setRole] = useState<"Admin" | "Moderator">("Moderator");

	const { data: users = [], refetch } = useQuery(trpc.users.list.queryOptions());
	const createMutation = useMutation(
		trpc.users.create.mutationOptions({
			onSuccess: () => refetch(),
		}),
	);
	const updateMutation = useMutation(
		trpc.users.update.mutationOptions({
			onSuccess: () => refetch(),
		}),
	);
	const deleteMutation = useMutation(
		trpc.users.delete.mutationOptions({
			onSuccess: () => refetch(),
		}),
	);

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!email || !givenName || !familyName) return;

		try {
			await createMutation.mutateAsync({
				email,
				givenName,
				familyName,
				role,
			});
			notification.success(`${givenName} ${familyName} wurde eingeladen`);
			setEmail("");
			setGivenName("");
			setFamilyName("");
			setRole("Moderator");
			closeCreate();
		} catch (error) {
			notification.error({ title: "Fehler beim Erstellen", message: error instanceof Error ? error.message : "Ein Fehler ist aufgetreten" });
		}
	};

	const handleOpenEdit = (user: { email: string; givenName: string; familyName: string; groups: string[] }) => {
		setEditingEmail(user.email);
		setGivenName(user.givenName);
		setFamilyName(user.familyName);
		setRole((user.groups[0] || "Moderator") as "Admin" | "Moderator");
		openEdit();
	};

	const handleUpdate = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!editingEmail || !givenName || !familyName) return;

		try {
			await updateMutation.mutateAsync({
				email: editingEmail,
				givenName,
				familyName,
				role,
			});
			notification.success("Benutzerdaten aktualisiert");
			setEditingEmail("");
			setGivenName("");
			setFamilyName("");
			setRole("Moderator");
			closeEdit();
		} catch (error) {
			notification.error({ title: "Fehler beim Aktualisieren", message: error instanceof Error ? error.message : "Ein Fehler ist aufgetreten" });
		}
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

			<Table striped highlightOnHover visibleFrom="sm">
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
				<form onSubmit={handleCreate}>
					<Stack gap="md">
						<TextInput label="E-Mail" placeholder={`person@example.com`} required value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
						<TextInput label="Vorname" placeholder="Erika" required value={givenName} onChange={(e) => setGivenName(e.currentTarget.value)} />
						<TextInput label="Nachname" placeholder="Mustermann" required value={familyName} onChange={(e) => setFamilyName(e.currentTarget.value)} />
						<Radio.Group label="Rolle" required value={role} onChange={(value) => setRole(value as "Admin" | "Moderator")}>
							<Stack gap="xs">
								<Radio value="Admin" label="Admin (voller Zugriff)" />
								<Radio value="Moderator" label="Moderator (nur Inhalte)" />
							</Stack>
						</Radio.Group>
						<Text size="sm" c="dimmed">
							Eine Einladungs-E-Mail mit temporären Zugangsdaten wird an den Benutzer gesendet.
						</Text>
						<Group justify="flex-end" gap="sm">
							<Button variant="subtle" onClick={closeCreate}>
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
				<form onSubmit={handleUpdate}>
					<Stack gap="md">
						<TextInput label="Vorname" placeholder="Max" required value={givenName} onChange={(e) => setGivenName(e.currentTarget.value)} />
						<TextInput label="Nachname" placeholder="Mustermann" required value={familyName} onChange={(e) => setFamilyName(e.currentTarget.value)} />
						<Radio.Group label="Rolle" required value={role} onChange={(value) => setRole(value as "Admin" | "Moderator")}>
							<Stack gap="xs">
								<Radio value="Admin" label="Admin (voller Zugriff)" />
								<Radio value="Moderator" label="Moderator (nur Inhalte)" />
							</Stack>
						</Radio.Group>
						<Group justify="space-between">
							{editingEmail && currentUser?.email !== editingEmail ? (
								<ActionIcon color="red" variant="light" onClick={() => setDeleteTarget(editingEmail)} loading={deleteMutation.isPending} title="Benutzer dauerhaft löschen" radius="xl" size="lg">
									<Trash2 size={20} />
								</ActionIcon>
							) : (
								<Box />
							)}
							<Group gap="sm">
								<Button variant="light" onClick={closeEdit}>
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
