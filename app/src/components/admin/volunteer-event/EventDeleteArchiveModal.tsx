import { Button, Group, Loader, Modal, Stack, Text } from "@mantine/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNotification } from "@webapp/hooks/useNotification";
import {
  archiveVolunteerEventFn,
  deleteVolunteerEventFn,
  listVolunteerSignupsFn,
} from "@webapp/server/functions/volunteer";
import type { VolunteerEvent } from "@/lib/db/types";

export function EventDeleteArchiveModal({
  opened,
  onClose,
  event,
  onDone,
}: {
  opened: boolean;
  onClose: () => void;
  event: VolunteerEvent | null;
  onDone: () => void;
}) {
  const notification = useNotification();

  const { data: signupsData, isLoading } = useQuery({
    queryKey: ["volunteerSignups", event?.id, "deleteCheck"],
    queryFn: () => listVolunteerSignupsFn({ data: { eventId: event!.id } }),
    enabled: !!event && opened,
  });

  const hasSignups = (signupsData?.items.length ?? 0) > 0;

  const deleteMutation = useMutation({
    mutationFn: () => deleteVolunteerEventFn({ data: { id: event!.id } }),
    onSuccess: () => {
      onDone();
      notification.success("Veranstaltung wurde gelöscht");
    },
    onError: () => notification.error({ message: "Veranstaltung konnte nicht gelöscht werden" }),
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveVolunteerEventFn({ data: { id: event!.id } }),
    onSuccess: () => {
      onDone();
      notification.success("Veranstaltung wurde archiviert");
    },
    onError: () => notification.error({ message: "Veranstaltung konnte nicht archiviert werden" }),
  });

  const isPending = deleteMutation.isPending || archiveMutation.isPending;

  return (
    <Modal opened={opened} onClose={onClose} title="Veranstaltung entfernen" size="sm">
      {isLoading ? (
        <Group justify="center" py="md">
          <Loader size="sm" />
        </Group>
      ) : hasSignups ? (
        <Stack gap="md">
          <Text size="sm">
            Diese Veranstaltung hat bestehende Anmeldungen und kann daher nicht gelöscht werden. Sie
            kann stattdessen archiviert werden — archivierte Veranstaltungen sind nicht mehr
            öffentlich zugänglich und können jederzeit wiederhergestellt werden.
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={onClose} disabled={isPending}>
              Abbrechen
            </Button>
            <Button
              color="orange"
              onClick={() => archiveMutation.mutate()}
              loading={archiveMutation.isPending}
            >
              Archivieren
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack gap="md">
          <Text size="sm">
            Soll diese Veranstaltung wirklich endgültig gelöscht werden? Diese Aktion kann nicht
            rückgängig gemacht werden.
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={onClose} disabled={isPending}>
              Abbrechen
            </Button>
            <Button
              color="red"
              onClick={() => deleteMutation.mutate()}
              loading={deleteMutation.isPending}
            >
              Löschen
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
