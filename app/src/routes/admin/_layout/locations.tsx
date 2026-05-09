import type { LocationInput } from "@lib/db/schemas";
import {
  ActionIcon,
  Button,
  Card,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { useForm } from "@tanstack/react-form-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useNotification } from "@webapp/hooks/useNotification";
import {
  createLocationFn,
  deleteLocationFn,
  listLocationsFn,
  updateLocationFn,
} from "@webapp/server/functions/locations";
import { Plus, SquarePen, Trash2 } from "lucide-react";

const defaultFormValues = {
  id: undefined as string | undefined,
  name: "",
  description: "",
  street: "",
  postal: "",
  city: "",
};

function LocationsPage() {
  const isMobile = useMediaQuery("(max-width: 48em)");
  const [opened, { open, close }] = useDisclosure(false);

  const notification = useNotification();
  const {
    data: locations,
    isLoading,
    refetch,
  } = useQuery({ queryKey: ["locations", "list"], queryFn: () => listLocationsFn() });
  const form = useForm({
    defaultValues: defaultFormValues,
    onSubmit: async ({ value }) => {
      const { id, ...payload } = value;
      if (!value.name || !value.street || !value.postal || !value.city) {
        notification.error({
          message: "Bitte füllen Sie alle Pflichtfelder aus",
        });
        return;
      }

      if (id) {
        updateMutation.mutate({
          id,
          data: payload,
        });
      } else {
        createMutation.mutate(payload as Omit<LocationInput, "id" | "createdAt" | "updatedAt">);
      }
    },
  });
  const editingId = form.getFieldValue("id");

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof createLocationFn>[0]["data"]) =>
      createLocationFn({ data }),
    onSuccess: () => {
      refetch();
      close();
      resetForm();
      notification.success("Ort wurde erfolgreich erstellt");
    },
    onError: (error: unknown) => {
      const err = error as Error;
      notification.error({
        message: err.message || "Ort konnte nicht erstellt werden",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateLocationFn>[0]["data"]) =>
      updateLocationFn({ data }),
    onSuccess: () => {
      refetch();
      close();
      resetForm();
      notification.success("Ort wurde erfolgreich aktualisiert");
    },
    onError: (error: unknown) => {
      const err = error as Error;
      notification.error({
        message: err.message || "Ort konnte nicht aktualisiert werden",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (data: Parameters<typeof deleteLocationFn>[0]["data"]) =>
      deleteLocationFn({ data }),
    onSuccess: () => {
      refetch();
      close();
      resetForm();
      notification.success("Ort wurde erfolgreich gelöscht");
    },
    onError: (error: unknown) => {
      const err = error as Error;
      notification.error({
        message: err.message || "Ort konnte nicht gelöscht werden",
      });
    },
  });

  const resetForm = () => {
    form.reset();
  };

  const handleEdit = (location: LocationInput) => {
    form.setFieldValue("id", location.id);
    form.setFieldValue("name", location.name);
    form.setFieldValue("description", location.description || "");
    form.setFieldValue("street", location.street);
    form.setFieldValue("postal", location.postal);
    form.setFieldValue("city", location.city);
    open();
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Möchten Sie diesen Ort wirklich löschen?")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleOpenNew = () => {
    resetForm();
    open();
  };

  locations?.items.sort((a: LocationInput, b: LocationInput) => a.name.localeCompare(b.name));

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Orte</Title>
        <Button onClick={handleOpenNew} leftSection={<Plus />} visibleFrom="sm">
          Neuer Ort
        </Button>
        <ActionIcon onClick={handleOpenNew} hiddenFrom="sm" variant="filled" radius="xl">
          <Plus size={20} />
        </ActionIcon>
      </Group>

      <Modal
        opened={opened}
        onClose={close}
        title={editingId ? "Ort bearbeiten" : "Neuer Ort"}
        size={isMobile ? "100%" : "lg"}
        fullScreen={isMobile}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Subscribe selector={(state) => state.values}>
            {(formData) => (
              <Stack gap="md" p={{ base: "md", sm: "sm" }}>
                <form.Field name="name">
                  {(field) => (
                    <TextInput
                      label="Name"
                      placeholder="z.B. Sporthalle Müllheim"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      required
                    />
                  )}
                </form.Field>
                <form.Field name="description">
                  {(field) => (
                    <Textarea
                      label="Beschreibung"
                      placeholder="Optional: Zusätzliche Informationen zum Ort"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      minRows={3}
                    />
                  )}
                </form.Field>
                <form.Field name="street">
                  {(field) => (
                    <TextInput
                      label="Straße"
                      placeholder="z.B. Sportplatzweg 1"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      required
                    />
                  )}
                </form.Field>
                <Group grow>
                  <form.Field name="postal">
                    {(field) => (
                      <TextInput
                        label="PLZ"
                        placeholder="z.B. 79379"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        required
                      />
                    )}
                  </form.Field>
                  <form.Field name="city">
                    {(field) => (
                      <TextInput
                        label="Stadt"
                        placeholder="z.B. Müllheim"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        required
                      />
                    )}
                  </form.Field>
                </Group>
                <Group justify="space-between" mt="md">
                  {editingId && (
                    <>
                      <ActionIcon
                        hiddenFrom="sm"
                        color="red"
                        variant="light"
                        onClick={() => handleDelete(editingId)}
                        loading={deleteMutation.isPending}
                        size="lg"
                      >
                        <Trash2 />
                      </ActionIcon>
                      <Button
                        visibleFrom="sm"
                        color="red"
                        variant="light"
                        onClick={() => handleDelete(editingId)}
                        loading={deleteMutation.isPending}
                      >
                        Löschen
                      </Button>
                    </>
                  )}
                  <Group gap="xs" ms="auto">
                    <Button variant="light" type="button" onClick={close}>
                      Abbrechen
                    </Button>
                    <Button
                      variant="filled"
                      type="submit"
                      loading={createMutation.isPending || updateMutation.isPending}
                      disabled={
                        !formData.name || !formData.street || !formData.postal || !formData.city
                      }
                    >
                      {editingId ? "Aktualisieren" : "Erstellen"}
                    </Button>
                  </Group>
                </Group>
              </Stack>
            )}
          </form.Subscribe>
        </form>
      </Modal>

      {isLoading ? (
        <Text>Laden...</Text>
      ) : locations && locations.items.length > 0 ? (
        <>
          <Card withBorder bg="white" p={0} radius="md" visibleFrom="sm">
            <Table striped highlightOnHover horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Adresse</Table.Th>
                  <Table.Th>Beschreibung</Table.Th>
                  <Table.Th>Aktionen</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {locations.items.map((location: LocationInput) => (
                  <Table.Tr key={location.id}>
                    <Table.Td>{location.name}</Table.Td>
                    <Table.Td>
                      {location.street}
                      <br />
                      {location.postal} {location.city}
                    </Table.Td>
                    <Table.Td>{location.description || "-"}</Table.Td>
                    <Table.Td>
                      <Button visibleFrom="sm" size="xs" onClick={() => handleEdit(location)}>
                        Bearbeiten
                      </Button>
                      <ActionIcon
                        hiddenFrom="sm"
                        variant="filled"
                        radius="xl"
                        onClick={() => handleEdit(location)}
                      >
                        <SquarePen size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>

          <SimpleGrid cols={{ base: 1, sm: 1 }} spacing="md" hiddenFrom="sm">
            {locations.items.map((location: LocationInput) => (
              <Card key={location.id} shadow="sm" p="md" radius="md" withBorder>
                <Stack gap="xs">
                  <Group justify="space-between" align="flex-start">
                    <Title order={4}>{location.name}</Title>
                    <ActionIcon
                      color="blumine"
                      variant="filled"
                      onClick={() => handleEdit(location)}
                      radius="xl"
                    >
                      <SquarePen size={16} />
                    </ActionIcon>
                  </Group>
                  <Stack gap="xs">
                    <div>
                      <Text size="xs" fw={500} c="dimmed">
                        Adresse
                      </Text>
                      <Text size="sm">
                        {location.street}
                        <br />
                        {location.postal} {location.city}
                      </Text>
                    </div>
                    {location.description && (
                      <div>
                        <Text size="xs" fw={500} c="dimmed">
                          Beschreibung
                        </Text>
                        <Text size="sm">{location.description}</Text>
                      </div>
                    )}
                  </Stack>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        </>
      ) : (
        <Text>Keine Orte vorhanden</Text>
      )}
    </Stack>
  );
}

export const Route = createFileRoute("/admin/_layout/locations")({
  component: LocationsPage,
});
