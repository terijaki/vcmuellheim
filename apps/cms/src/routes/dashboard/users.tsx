import { ActionIcon, Button, Group, Modal, Radio, Select, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTRPC } from "@/apps/shared/lib/trpc-config";
import { useNotification } from "../../hooks/useNotification";

export const Route = createFileRoute("/dashboard/users")({
	component: UsersPage,
});

function UsersPage() {
	const trpc = useTRPC();
	const notification = useNotification();
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
	const changeRoleMutation = useMutation(
		trpc.users.changeRole.mutationOptions({
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
				sendInvite: true,
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

	const handleOpenEdit = (user: { email: string; givenName: string; familyName: string }) => {
		setEditingEmail(user.email);
		setGivenName(user.givenName);
		setFamilyName(user.familyName);
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
			});
			notification.success("Benutzerdaten aktualisiert");
			setEditingEmail("");
			setGivenName("");
			setFamilyName("");
			closeEdit();
		} catch (error) {
			notification.error({ title: "Fehler beim Aktualisieren", message: error instanceof Error ? error.message : "Ein Fehler ist aufgetreten" });
		}
	};

	const handleChangeRole = async (email: string, newRole: "Admin" | "Moderator") => {
		try {
			await changeRoleMutation.mutateAsync({ email, role: newRole });
			notification.success(`Benutzerrolle geändert zu ${newRole}`);
		} catch (error) {
			notification.error({ title: "Fehler beim Ändern der Rolle", message: error instanceof Error ? error.message : "Ein Fehler ist aufgetreten" });
		}
	};

	const handleDelete = async (email: string) => {
		try {
			await deleteMutation.mutateAsync({ email });
			notification.neutral({ title: email, message: "Das Benutzerkonto wurde gelöscht" });
			setDeleteTarget(null);
		} catch (error) {
			notification.error({ title: "Fehler beim Löschen", message: error instanceof Error ? error.message : "Ein Fehler ist aufgetreten" });
		}
	};

	return (
		<Stack gap="md">
			<Group justify="space-between">
				<Title order={2}>Benutzerverwaltung</Title>
				<Button leftSection={<Plus size={16} />} onClick={openCreate}>
					Benutzer erstellen
				</Button>
			</Group>

			<Table striped highlightOnHover>
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
									<Select
										data={["Admin", "Moderator"]}
										value={role}
										onChange={(value) => value && handleChangeRole(user.email, value as "Admin" | "Moderator")}
										disabled={changeRoleMutation.isPending}
										size="xs"
										w={120}
									/>
								</Table.Td>
								<Table.Td>{new Date(user.created).toLocaleDateString("de-DE")}</Table.Td>
								<Table.Td>
									<Group gap="xs">
										<ActionIcon color="blumine" variant="filled" onClick={() => handleOpenEdit(user)} title="Benutzer bearbeiten" radius="xl">
											<Pencil size={16} />
										</ActionIcon>
										<ActionIcon color="red" variant="light" onClick={() => setDeleteTarget(user.email)} loading={deleteMutation.isPending} title="Benutzer dauerhaft löschen" radius="xl">
											<Trash2 size={16} />
										</ActionIcon>
									</Group>
								</Table.Td>
							</Table.Tr>
						);
					})}
				</Table.Tbody>
			</Table>

			{/* Create User Modal */}
			<Modal opened={createOpened} onClose={closeCreate} title="Neuen Benutzer erstellen" size="md">
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
			<Modal opened={editOpened} onClose={closeEdit} title="Benutzer bearbeiten" size="md">
				<form onSubmit={handleUpdate}>
					<Stack gap="md">
						<TextInput label="Vorname" placeholder="Max" required value={givenName} onChange={(e) => setGivenName(e.currentTarget.value)} />
						<TextInput label="Nachname" placeholder="Mustermann" required value={familyName} onChange={(e) => setFamilyName(e.currentTarget.value)} />
						<Group justify="flex-end" gap="sm">
							<Button variant="subtle" onClick={closeEdit}>
								Abbrechen
							</Button>
							<Button type="submit" loading={updateMutation.isPending}>
								Speichern
							</Button>
						</Group>
					</Stack>
				</form>
			</Modal>

			{/* Delete Confirmation Modal */}
			<Modal opened={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Benutzer löschen?" size="sm" centered>
				<Stack gap="md">
					<Text>Möchten Sie diesen Benutzer wirklich dauerhaft löschen? Diese Aktion kann nicht rückgängig gemacht werden.</Text>
					<Group justify="flex-end" gap="sm">
						<Button variant="subtle" onClick={() => setDeleteTarget(null)}>
							Abbrechen
						</Button>
						<Button color="red" onClick={() => deleteTarget && handleDelete(deleteTarget)} loading={deleteMutation.isPending}>
							Löschen
						</Button>
					</Group>
				</Stack>
			</Modal>
		</Stack>
	);
}
