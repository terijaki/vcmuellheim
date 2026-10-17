import {
  ActionIcon,
  Badge,
  Button,
  CopyButton,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { adminKeysGuard } from "@webapp/lib/auth-guards";
import { useNotification } from "@webapp/hooks/useNotification";
import { createApiKeyFn, deleteApiKeyFn, listApiKeysFn } from "@webapp/server/functions/api-keys";
import { adminListMembersFn } from "@webapp/server/functions/members";
import dayjs from "dayjs";
import { Trash2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/admin/_layout/api-keys")({
  beforeLoad: ({ context }) => {
    adminKeysGuard(context.user);
  },
  component: ApiKeysPage,
});

function ApiKeysPage() {
  const notification = useNotification();
  const queryClient = useQueryClient();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [label, setLabel] = useState("");
  const [memberId, setMemberId] = useState<string | null>(null);
  const [scope, setScope] = useState<string | null>("news");
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  const keysQuery = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => listApiKeysFn(),
  });
  const membersQuery = useQuery({
    queryKey: ["members", "admin"],
    queryFn: () => adminListMembersFn(),
  });

  const cmsMembers = (membersQuery.data?.items ?? []).filter(
    (member) => member.authRole === "Admin" || member.authRole === "Moderator",
  );
  const memberNames = new Map(
    (membersQuery.data?.items ?? []).map((member) => [member.id, member.name]),
  );

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof createApiKeyFn>[0]["data"]) => createApiKeyFn({ data }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      closeCreate();
      setLabel("");
      setMemberId(null);
      setScope("news");
      setCreatedToken(result.token);
    },
    onError: (error) => {
      notification.error({
        message: error instanceof Error ? error.message : "Schlüssel konnte nicht erstellt werden",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApiKeyFn({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      notification.success("API-Schlüssel wurde gelöscht");
    },
    onError: (error) => {
      notification.error({
        message: error instanceof Error ? error.message : "Schlüssel konnte nicht gelöscht werden",
      });
    },
  });

  const submitCreate = () => {
    const trimmed = label.trim();
    if (!trimmed || !memberId || scope !== "news") return;
    createMutation.mutate({ label: trimmed, memberId, scope: "news" });
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>API-Schlüssel</Title>
        <Button onClick={openCreate}>Schlüssel erstellen</Button>
      </Group>
      <Text c="dimmed" size="sm">
        Jeder Schlüssel gehört zu einem Mitglied, hat einen festen Bereich und läuft nach einem Jahr
        ab. Der Bereich kann nicht geändert werden.
      </Text>

      {keysQuery.isLoading ? (
        <Text>Laden…</Text>
      ) : (
        <Table.ScrollContainer minWidth={880}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Bezeichnung</Table.Th>
                <Table.Th>Mitglied</Table.Th>
                <Table.Th>Bereich</Table.Th>
                <Table.Th>Präfix</Table.Th>
                <Table.Th>Erstellt</Table.Th>
                <Table.Th>Gültig bis</Table.Th>
                <Table.Th>Zuletzt verwendet</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(keysQuery.data ?? []).map((apiKey) => {
                const expired = !dayjs(apiKey.expiresAt).isAfter(dayjs());
                return (
                  <Table.Tr key={apiKey.id}>
                    <Table.Td>{apiKey.label}</Table.Td>
                    <Table.Td>{memberNames.get(apiKey.memberId) ?? apiKey.memberId}</Table.Td>
                    <Table.Td>{apiKey.scope === "news" ? "News" : apiKey.scope}</Table.Td>
                    <Table.Td>
                      <Text ff="monospace" size="sm">
                        {apiKey.prefix}
                      </Text>
                    </Table.Td>
                    <Table.Td>{dayjs(apiKey.createdAt).format("DD.MM.YYYY")}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        {dayjs(apiKey.expiresAt).format("DD.MM.YYYY")}
                        {expired && (
                          <Badge color="red" variant="light">
                            Abgelaufen
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      {apiKey.lastUsedAt
                        ? dayjs(apiKey.lastUsedAt).format("DD.MM.YYYY HH:mm")
                        : "—"}
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label={`Schlüssel ${apiKey.label} löschen`}
                        onClick={() => {
                          if (window.confirm(`Schlüssel „${apiKey.label}“ wirklich löschen?`)) {
                            deleteMutation.mutate(apiKey.id);
                          }
                        }}
                      >
                        <Trash2 size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
              {(keysQuery.data ?? []).length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Text c="dimmed">Noch keine API-Schlüssel.</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      <Modal opened={createOpened} onClose={closeCreate} title="API-Schlüssel erstellen">
        <Stack>
          <TextInput
            label="Bezeichnung"
            value={label}
            onChange={(event) => setLabel(event.currentTarget.value)}
            maxLength={100}
            required
          />
          <Select
            label="Mitglied"
            placeholder="Mitglied wählen"
            data={cmsMembers.map((member) => ({
              value: member.id,
              label: `${member.name} (${member.authRole})`,
            }))}
            value={memberId}
            onChange={setMemberId}
            required
            searchable
          />
          <Select
            label="Bereich"
            data={[{ value: "news", label: "News" }]}
            value={scope}
            onChange={setScope}
            allowDeselect={false}
            required
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeCreate}>
              Abbrechen
            </Button>
            <Button
              onClick={submitCreate}
              loading={createMutation.isPending}
              disabled={!label.trim() || !memberId || scope !== "news"}
            >
              Erstellen
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={createdToken !== null}
        onClose={() => {
          setCreatedToken(null);
          createMutation.reset();
        }}
        title="Schlüssel kopieren"
      >
        <Stack>
          <Text>
            Dieser Schlüssel wird nur einmal angezeigt. Speichere ihn jetzt. Er kann später nicht
            wieder angezeigt werden.
          </Text>
          <TextInput readOnly value={createdToken ?? ""} ff="monospace" />
          <Group justify="flex-end">
            <CopyButton value={createdToken ?? ""}>
              {({ copied, copy }) => (
                <Button onClick={copy}>{copied ? "Kopiert" : "Kopieren"}</Button>
              )}
            </CopyButton>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
