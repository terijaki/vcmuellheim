import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Collapse,
  Group,
  Menu,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNotification } from "@webapp/hooks/useNotification";
import { listVolunteerEventsFn, restoreVolunteerEventFn } from "@webapp/server/functions/volunteer";
import { getAppBaseUrlFn } from "@webapp/server/functions/app-base-url";
import { EventDeleteArchiveModal } from "@webapp/components/admin/volunteer-event/EventDeleteArchiveModal";
import { EventFormModal } from "@webapp/components/admin/volunteer-event/EventFormModal";
import { SignupDashboard } from "@webapp/components/admin/volunteer-event/SignupDashboard";
import {
  buildTemplateData,
  type EventFormInitialData,
} from "@webapp/components/admin/volunteer-event/types";
import dayjs from "dayjs";
import "dayjs/locale/de";
import {
  Archive,
  ChevronDown,
  ChevronUp,
  Copy,
  EllipsisVertical,
  ExternalLink,
  Link,
  Mail,
  Plus,
  SquarePen,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import type { VolunteerEvent } from "@/lib/db/types";

dayjs.locale("de");

function getEventShiftDateRange(event: VolunteerEvent): string {
  const firstShift = event.shifts[0];
  if (!firstShift) {
    return "Kein Schichtdatum";
  }

  const eventStart = event.shifts.reduce((earliestStart, shift) => {
    return dayjs(shift.startDate).isBefore(dayjs(earliestStart)) ? shift.startDate : earliestStart;
  }, firstShift.startDate);

  const eventEnd = event.shifts.reduce((latestEnd, shift) => {
    const shiftEnd = shift.endDate ?? shift.startDate;
    return dayjs(shiftEnd).isAfter(dayjs(latestEnd)) ? shiftEnd : latestEnd;
  }, firstShift.endDate ?? firstShift.startDate);

  const start = dayjs(eventStart);
  const end = dayjs(eventEnd);

  if (start.isSame(end, "day")) {
    return `${start.format("D. MMMM YYYY HH:mm")} - ${end.format("HH:mm")}`;
  }

  return `${start.format("D. MMMM YYYY")} - ${end.format("D. MMMM YYYY")}`;
}

export const Route = createFileRoute("/admin/_layout/volunteer-event")({
  loader: async () => {
    const [data, appBaseUrl] = await Promise.all([listVolunteerEventsFn(), getAppBaseUrlFn()]);
    return { events: data.items, appBaseUrl };
  },
  component: VolunteerEventAdminPage,
});

function VolunteerEventAdminPage() {
  const { events: initialEvents, appBaseUrl } = Route.useLoaderData();
  const notification = useNotification();
  const navigate = useNavigate();

  const { data: eventsData, refetch } = useQuery({
    queryKey: ["volunteerEvents", "admin"],
    queryFn: () => listVolunteerEventsFn(),
    initialData: { items: initialEvents },
  });

  const [formOpened, { open: openForm, close: closeForm }] = useDisclosure(false);
  const [editingEvent, setEditingEvent] = useState<VolunteerEvent | null>(null);
  const [templateData, setTemplateData] = useState<EventFormInitialData | null>(null);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] =
    useDisclosure(false);
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState<VolunteerEvent | null>(null);
  const [archivedVisible, { toggle: toggleArchived }] = useDisclosure(false);

  const restoreEventMutation = useMutation({
    mutationFn: (id: string) => restoreVolunteerEventFn({ data: { id } }),
    onSuccess: () => {
      refetch();
      notification.success("Veranstaltung wurde wiederhergestellt");
    },
    onError: () =>
      notification.error({ message: "Veranstaltung konnte nicht wiederhergestellt werden" }),
  });

  const events = eventsData.items;
  const activeEvents = events
    .filter((e) => !e.archivedAt)
    .sort((a, b) => dayjs(a.shifts[0]?.startDate).diff(dayjs(b.shifts[0]?.startDate)));
  const archivedEvents = events
    .filter((e) => !!e.archivedAt)
    .sort((a, b) => dayjs(b.shifts[0]?.startDate).diff(dayjs(a.shifts[0]?.startDate)));

  function openCreate() {
    setEditingEvent(null);
    setTemplateData(null);
    openForm();
  }

  function openEdit(event: VolunteerEvent) {
    setEditingEvent(event);
    setTemplateData(null);
    openForm();
  }

  function openFromTemplate(event: VolunteerEvent) {
    setEditingEvent(null);
    setTemplateData(buildTemplateData(event));
    openForm();
  }

  function handleFormClose() {
    closeForm();
    setTemplateData(null);
  }

  return (
    <>
      <EventFormModal
        key={editingEvent?.id ?? (templateData ? `template-${templateData._sourceId}` : "new")}
        opened={formOpened}
        onClose={handleFormClose}
        editingEvent={editingEvent}
        initialData={templateData ?? undefined}
        onSaved={refetch}
      />
      <EventDeleteArchiveModal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        event={pendingDeleteEvent}
        onDone={() => {
          refetch();
          closeDeleteModal();
        }}
      />

      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={2}>Veranstaltungen</Title>
          <Button leftSection={<Plus size={16} />} onClick={openCreate}>
            Neue Veranstaltung
          </Button>
        </Group>

        {activeEvents.length === 0 && archivedEvents.length === 0 && (
          <Card>
            <Text c="dimmed">Noch keine Veranstaltungen erstellt.</Text>
          </Card>
        )}

        {activeEvents.map((event) => {
          const deeplink = `${appBaseUrl}/e/${event.id}`;
          return (
            <Card key={event.id} withBorder>
              <Stack gap="sm">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap="xs">
                    <Title order={4}>{event.title}</Title>
                    {event.location && (
                      <Text
                        size="sm"
                        c="dimmed"
                        component={event.locationUrl ? "a" : "span"}
                        href={event.locationUrl ?? undefined}
                        target={event.locationUrl ? "_blank" : undefined}
                        rel={event.locationUrl ? "noopener noreferrer" : undefined}
                      >
                        {event.location}
                      </Text>
                    )}
                    <Text size="xs" c="dimmed">
                      {getEventShiftDateRange(event)}
                    </Text>
                  </Stack>
                  <Menu shadow="md" position="bottom-end">
                    <Menu.Target>
                      <ActionIcon variant="subtle" aria-label="Aktionen">
                        <EllipsisVertical size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<SquarePen size={14} />}
                        onClick={() => openEdit(event)}
                      >
                        Bearbeiten
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<Link size={14} />}
                        onClick={() =>
                          navigator.clipboard
                            .writeText(deeplink)
                            .catch(() =>
                              notification.error({ message: "Link konnte nicht kopiert werden" }),
                            )
                        }
                      >
                        Link kopieren
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<ExternalLink size={14} />}
                        component="a"
                        href={deeplink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Öffentliche Seite öffnen
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<Mail size={14} />}
                        onClick={() =>
                          navigate({
                            to: "/admin/volunteer-event/$eventId/message",
                            params: { eventId: event.id },
                          })
                        }
                      >
                        E-Mail senden
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item
                        leftSection={<Copy size={14} />}
                        onClick={() => openFromTemplate(event)}
                      >
                        Als Vorlage verwenden
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item
                        color="red"
                        leftSection={<Trash2 size={14} />}
                        onClick={() => {
                          setPendingDeleteEvent(event);
                          openDeleteModal();
                        }}
                      >
                        Archivieren / Löschen
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>

                <SignupDashboard event={event} />
              </Stack>
            </Card>
          );
        })}

        {archivedEvents.length > 0 && (
          <>
            <Group justify="space-between" mt="md">
              <Title order={4} c="dimmed">
                Archivierte Veranstaltungen
              </Title>
              <Button
                size="xs"
                variant="subtle"
                rightSection={archivedVisible ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                onClick={toggleArchived}
              >
                {archivedVisible ? "Ausblenden" : `Anzeigen (${archivedEvents.length})`}
              </Button>
            </Group>
            <Collapse expanded={archivedVisible}>
              <Stack gap="lg">
                {archivedEvents.map((event) => (
                  <Card key={event.id} withBorder style={{ opacity: 0.65 }}>
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Group gap="xs" mb={2}>
                          <Title order={4}>{event.title}</Title>
                          <Badge variant="outline" color="gray" size="sm">
                            Archiviert
                          </Badge>
                        </Group>
                        {event.location && (
                          <Text size="sm" c="dimmed">
                            {event.location}
                          </Text>
                        )}
                        <Text size="xs" c="dimmed">
                          {getEventShiftDateRange(event)}
                        </Text>
                      </div>
                      <Menu shadow="md" position="bottom-end">
                        <Menu.Target>
                          <ActionIcon variant="subtle" aria-label="Aktionen">
                            <EllipsisVertical size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<SquarePen size={14} />}
                            onClick={() => openEdit(event)}
                          >
                            Bearbeiten
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<Copy size={14} />}
                            onClick={() => openFromTemplate(event)}
                          >
                            Als Vorlage verwenden
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<Link size={14} />}
                            onClick={() =>
                              navigator.clipboard
                                .writeText(`${appBaseUrl}/e/${event.id}`)
                                .catch(() =>
                                  notification.error({
                                    message: "Link konnte nicht kopiert werden",
                                  }),
                                )
                            }
                          >
                            Link kopieren
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<Mail size={14} />}
                            onClick={() =>
                              navigate({
                                to: "/admin/volunteer-event/$eventId/message",
                                params: { eventId: event.id },
                              })
                            }
                          >
                            E-Mail senden
                          </Menu.Item>
                          <Menu.Divider />
                          <Menu.Item
                            leftSection={<Archive size={14} />}
                            disabled={restoreEventMutation.isPending}
                            onClick={() => restoreEventMutation.mutate(event.id)}
                          >
                            Wiederherstellen
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Card>
                ))}
              </Stack>
            </Collapse>
          </>
        )}
      </Stack>
    </>
  );
}
