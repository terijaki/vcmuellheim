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
  UnstyledButton,
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
import { getVolunteerEventGroup } from "@webapp/utils/volunteer";

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
  const [pastVisible, { toggle: togglePast }] = useDisclosure(false);
  const [collapsedEventIds, setCollapsedEventIds] = useState<Record<string, boolean>>({});

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
  const groupedEvents = events.reduce<Record<"active" | "past" | "archived", VolunteerEvent[]>>(
    (acc, event) => {
      const group = getVolunteerEventGroup(event);
      acc[group].push(event);
      return acc;
    },
    { active: [], past: [], archived: [] },
  );

  const pastEventIds = new Set(groupedEvents.past.map((event) => event.id));

  function isEventExpanded(eventId: string): boolean {
    const isCollapsed = collapsedEventIds[eventId];
    if (typeof isCollapsed === "boolean") {
      return !isCollapsed;
    }

    return !pastEventIds.has(eventId);
  }

  function toggleEventExpanded(eventId: string) {
    setCollapsedEventIds((previousState) => {
      const isCollapsed =
        typeof previousState[eventId] === "boolean"
          ? previousState[eventId]
          : pastEventIds.has(eventId);

      return {
        ...previousState,
        [eventId]: !isCollapsed,
      };
    });
  }

  const activeEvents = groupedEvents.active.sort((a, b) =>
    dayjs(a.shifts[0]?.startDate).diff(dayjs(b.shifts[0]?.startDate)),
  );
  const pastEvents = groupedEvents.past.sort((a, b) =>
    dayjs(b.shifts[0]?.startDate).diff(dayjs(a.shifts[0]?.startDate)),
  );
  const archivedEvents = groupedEvents.archived.sort((a, b) =>
    dayjs(b.shifts[0]?.startDate).diff(dayjs(a.shifts[0]?.startDate)),
  );

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

        {activeEvents.length === 0 && pastEvents.length === 0 && archivedEvents.length === 0 && (
          <Card>
            <Text c="dimmed">Noch keine Veranstaltungen erstellt.</Text>
          </Card>
        )}

        {activeEvents.map((event) => {
          const deeplink = `${appBaseUrl}/e/${event.id}`;
          return (
            <Card key={event.id} withBorder>
              <Stack gap="sm">
                <Group>
                  <Stack gap="xs" flex={1}>
                    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
                      <UnstyledButton
                        component={Title}
                        order={4}
                        flex={1}
                        onClick={() => toggleEventExpanded(event.id)}
                      >
                        {event.title}
                      </UnstyledButton>
                      <Group gap="xs" wrap="nowrap">
                        <ActionIcon
                          variant="subtle"
                          aria-label={
                            isEventExpanded(event.id)
                              ? "Veranstaltung einklappen"
                              : "Veranstaltung ausklappen"
                          }
                          onClick={() => toggleEventExpanded(event.id)}
                        >
                          {isEventExpanded(event.id) ? (
                            <ChevronUp size={16} />
                          ) : (
                            <ChevronDown size={16} />
                          )}
                        </ActionIcon>
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
                                navigator.clipboard.writeText(deeplink).catch(() =>
                                  notification.error({
                                    message: "Link konnte nicht kopiert werden",
                                  }),
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
                    </Group>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed">
                        {getEventShiftDateRange(event)}
                      </Text>
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
                    </Group>
                  </Stack>
                </Group>

                <Collapse expanded={isEventExpanded(event.id)}>
                  <SignupDashboard event={event} />
                </Collapse>
              </Stack>
            </Card>
          );
        })}

        {pastEvents.length > 0 && (
          <Stack gap="xs">
            <UnstyledButton component={Group} justify="space-between" mt="md" onClick={togglePast}>
              <Title order={4}>Vergangene Veranstaltungen</Title>
              {pastVisible ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </UnstyledButton>

            <Collapse expanded={pastVisible}>
              <Stack gap="md">
                {pastEvents.map((event) => {
                  const deeplink = `${appBaseUrl}/e/${event.id}`;
                  return (
                    <Card key={event.id} withBorder style={{ opacity: 0.9 }}>
                      <Stack gap="sm">
                        <Group>
                          <Stack gap="xs" flex={1}>
                            <Group
                              justify="space-between"
                              align="flex-start"
                              wrap="nowrap"
                              gap="xs"
                            >
                              <UnstyledButton
                                component={Group}
                                gap="xs"
                                flex={1}
                                wrap="nowrap"
                                onClick={() => toggleEventExpanded(event.id)}
                              >
                                <Title order={4} flex={1}>
                                  {event.title}
                                </Title>
                                <Badge variant="outline" color="gray" size="sm">
                                  Vergangen
                                </Badge>
                              </UnstyledButton>
                              <Group gap="xs" wrap="nowrap">
                                <ActionIcon
                                  variant="subtle"
                                  aria-label={
                                    isEventExpanded(event.id)
                                      ? "Veranstaltung einklappen"
                                      : "Veranstaltung ausklappen"
                                  }
                                  onClick={() => toggleEventExpanded(event.id)}
                                >
                                  {isEventExpanded(event.id) ? (
                                    <ChevronUp size={16} />
                                  ) : (
                                    <ChevronDown size={16} />
                                  )}
                                </ActionIcon>
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
                                        navigator.clipboard.writeText(deeplink).catch(() =>
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
                                  </Menu.Dropdown>
                                </Menu>
                              </Group>
                            </Group>
                            <Group gap="xs">
                              <Text size="xs" c="dimmed">
                                {getEventShiftDateRange(event)}
                              </Text>
                              {event.location && (
                                <Text size="sm" c="dimmed">
                                  {event.location}
                                </Text>
                              )}
                            </Group>
                          </Stack>
                        </Group>

                        <Collapse expanded={isEventExpanded(event.id)}>
                          <SignupDashboard event={event} isPastEvent />
                        </Collapse>
                      </Stack>
                    </Card>
                  );
                })}
              </Stack>
            </Collapse>
          </Stack>
        )}

        {archivedEvents.length > 0 && (
          <Stack gap="xs">
            <UnstyledButton
              component={Group}
              justify="space-between"
              mt="md"
              onClick={toggleArchived}
            >
              <Title order={4}>Archivierte Veranstaltungen</Title>
              {archivedVisible ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </UnstyledButton>
            <Collapse expanded={archivedVisible}>
              <Stack gap="md">
                {archivedEvents.map((event) => (
                  <Card key={event.id} withBorder style={{ opacity: 0.65 }}>
                    <Stack gap="sm">
                      <Group>
                        <Stack gap="xs" flex={1}>
                          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
                            <UnstyledButton
                              component={Group}
                              gap="xs"
                              flex={1}
                              wrap="nowrap"
                              onClick={() => toggleEventExpanded(event.id)}
                            >
                              <Title order={4} flex={1}>
                                {event.title}
                              </Title>
                              <Badge variant="outline" color="gray" size="sm">
                                Archiviert
                              </Badge>
                            </UnstyledButton>

                            <Group gap="xs" wrap="nowrap">
                              <ActionIcon
                                variant="subtle"
                                aria-label={
                                  isEventExpanded(event.id)
                                    ? "Veranstaltung einklappen"
                                    : "Veranstaltung ausklappen"
                                }
                                onClick={() => toggleEventExpanded(event.id)}
                              >
                                {isEventExpanded(event.id) ? (
                                  <ChevronUp size={16} />
                                ) : (
                                  <ChevronDown size={16} />
                                )}
                              </ActionIcon>
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
                          </Group>

                          <Collapse expanded={isEventExpanded(event.id)}>
                            <Group gap="xs">
                              <Text size="xs" c="dimmed">
                                {getEventShiftDateRange(event)}
                              </Text>
                              {event.location && (
                                <Text size="sm" c="dimmed">
                                  {event.location}
                                </Text>
                              )}
                            </Group>
                          </Collapse>
                        </Stack>
                      </Group>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            </Collapse>
          </Stack>
        )}
      </Stack>
    </>
  );
}
