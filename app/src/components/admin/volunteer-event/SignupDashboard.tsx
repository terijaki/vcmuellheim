import {
  Accordion,
  ActionIcon,
  Badge,
  Box,
  Card,
  Group,
  Loader,
  Menu,
  Select,
  Stack,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNotification } from "@webapp/hooks/useNotification";
import {
  cancelVolunteerSignupFn,
  confirmVolunteerSignupFn,
  listVolunteerSignupsFn,
  updateVolunteerSignupFn,
} from "@webapp/server/functions/volunteer";
import dayjs from "dayjs";
import { ArrowLeftRight, Ban, Mail, SquareCheckBig } from "lucide-react";
import type { VolunteerEvent } from "@/lib/db/types";
import { getVolunteerSignupRoleLabel } from "@webapp/utils/volunteer";

export function SignupDashboard({
  event,
  isPastEvent = false,
  showCanceled = false,
}: {
  event: VolunteerEvent;
  isPastEvent?: boolean;
  showCanceled?: boolean;
}) {
  const notification = useNotification();

  const { data: signupsData, refetch } = useQuery({
    queryKey: ["volunteerSignups", event.id],
    queryFn: () => listVolunteerSignupsFn({ data: { eventId: event.id } }),
  });
  const isSignupsLoading = !signupsData;

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelVolunteerSignupFn({ data: { id } }),
    onSuccess: () => {
      refetch();
      notification.success("Anmeldung storniert");
    },
    onError: () => notification.error({ message: "Anmeldung konnte nicht storniert werden" }),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => confirmVolunteerSignupFn({ data: { id } }),
    onSuccess: () => {
      refetch();
      notification.success("Anmeldung bestätigt");
    },
    onError: () => notification.error({ message: "Anmeldung konnte nicht bestätigt werden" }),
  });

  const assignRoleMutation = useMutation({
    mutationFn: ({ id, assignedRoleId }: { id: string; assignedRoleId: string | null }) =>
      updateVolunteerSignupFn({ data: { id, data: { assignedRoleId } } }),
    onSuccess: () => refetch(),
    onError: () => notification.error({ message: "Rolle konnte nicht zugewiesen werden" }),
  });

  const moveShiftMutation = useMutation({
    mutationFn: ({ id, shiftId }: { id: string; shiftId: string }) =>
      updateVolunteerSignupFn({ data: { id, data: { shiftId } } }),
    onSuccess: () => {
      refetch();
      notification.success("Schicht geändert");
    },
    onError: () => notification.error({ message: "Schicht konnte nicht geändert werden" }),
  });

  const signups = signupsData?.items ?? [];
  const allRoles = event.shifts.flatMap((s) =>
    s.roles.map((r) => ({ ...r, shiftId: s.id, shiftLabel: s.label })),
  );
  const isMobile = useMediaQuery("(max-width: 62em)");
  const hasMultipleShifts = event.shifts.length > 1;

  return (
    <Accordion multiple variant="contained" mt="sm">
      {event.shifts
        .sort((a, b) => dayjs(a.startDate).diff(dayjs(b.startDate)))
        .map((shift) => {
          const shiftSignups = signups.filter((s) => s.shiftId === shift.id);
          const operationalSignups = shiftSignups.filter((s) => s.status !== "canceled");
          const sortedSignups = [...shiftSignups].sort((a, b) => {
            if (a.status === "canceled" && b.status !== "canceled") return 1;
            if (b.status === "canceled" && a.status !== "canceled") return -1;
            const roleA = a.assignedRoleId
              ? (shift.roles.find((role) => role.id === a.assignedRoleId)?.label ?? "")
              : "";
            const roleB = b.assignedRoleId
              ? (shift.roles.find((role) => role.id === b.assignedRoleId)?.label ?? "")
              : "";
            const preferredA = a.preferredRoleIds
              .map((roleId) => allRoles.find((role) => role.id === roleId)?.label ?? "")
              .filter(Boolean)
              .join(",");
            const preferredB = b.preferredRoleIds
              .map((roleId) => allRoles.find((role) => role.id === roleId)?.label ?? "")
              .filter(Boolean)
              .join(",");

            const primaryA = roleA || preferredA || "";
            const primaryB = roleB || preferredB || "";
            return primaryA.localeCompare(primaryB, "de", { sensitivity: "base" });
          });
          const visibleSignupsBase = showCanceled
            ? sortedSignups
            : sortedSignups.filter((signup) => signup.status !== "canceled");
          const visibleSignups = isPastEvent
            ? visibleSignupsBase.filter((signup) => signup.status !== "pending")
            : visibleSignupsBase;
          const unassignedCount =
            shift.roles.length > 0
              ? operationalSignups.filter((s) => s.status === "confirmed" && !s.assignedRoleId)
                  .length
              : 0;
          return (
            <Accordion.Item key={shift.id} value={shift.id}>
              <Accordion.Control>
                <Box>
                  <Text fw={500}>
                    {shift.label} —{" "}
                    <Text span size="sm" c="dimmed">
                      {dayjs(shift.startDate).format("DD.MM.YYYY HH:mm")}{" "}
                      {shift.endDate && (
                        <>
                          {" "}
                          –{" "}
                          {dayjs(shift.endDate).isSame(dayjs(shift.startDate), "day")
                            ? dayjs(shift.endDate).format("HH:mm")
                            : dayjs(shift.endDate).format("DD.MM.YYYY HH:mm")}
                        </>
                      )}{" "}
                    </Text>
                  </Text>
                  <Group gap="xs" mt={4}>
                    {shift.roles.map((role) => {
                      const count = operationalSignups.filter(
                        (s) => s.assignedRoleId === role.id,
                      ).length;
                      const color = isSignupsLoading
                        ? "gray"
                        : count === 0
                          ? "red"
                          : count >= role.minCapacity
                            ? "green"
                            : "blue";
                      return (
                        <Badge
                          key={role.id}
                          size="sm"
                          variant="light"
                          color={color}
                          rightSection={isSignupsLoading ? <Loader size="xs" /> : null}
                        >
                          {role.label}:{" "}
                          {isSignupsLoading
                            ? ""
                            : role.maxCapacity !== undefined
                              ? `${count}/${role.maxCapacity}`
                              : count}
                        </Badge>
                      );
                    })}
                    {shift.roles.length === 0 && (
                      <Badge size="sm" variant="outline">
                        {operationalSignups.length} Anmeldung
                        {operationalSignups.length !== 1 ? "en" : ""}
                      </Badge>
                    )}
                    {unassignedCount > 0 && (
                      <Badge size="sm" variant="filled" color="onyx">
                        {unassignedCount} Keine Zuweisung
                      </Badge>
                    )}
                  </Group>
                </Box>
              </Accordion.Control>
              <Accordion.Panel>
                {visibleSignups.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    Noch keine Anmeldungen.
                  </Text>
                ) : isMobile ? (
                  <Stack gap="sm">
                    {visibleSignups.map((signup) => {
                      const shiftOptions = event.shifts
                        .filter((s) => s.id !== signup.shiftId)
                        .map((s) => ({ value: s.id, label: s.label }));
                      const ageAtEvent = dayjs(shift.startDate).diff(
                        dayjs(signup.dateOfBirth),
                        "year",
                      );
                      const ageColor =
                        ageAtEvent >= 18 ? "green" : ageAtEvent >= 16 ? "blue" : "orange";
                      return (
                        <Card key={signup.id} withBorder p="xs">
                          <Group justify="space-between" wrap="nowrap" mb={4}>
                            <Group gap={6} wrap="nowrap">
                              <Badge size="xs" variant="light" color={ageColor}>
                                {ageAtEvent}
                              </Badge>
                              <Tooltip
                                label={signup.association || "Keine Zugehörigkeit angegeben"}
                              >
                                <Text fw={600} size="sm">
                                  {signup.firstName} {signup.lastName}
                                </Text>
                              </Tooltip>
                            </Group>
                            <Group gap={4} wrap="nowrap">
                              {signup.status !== "confirmed" && (
                                <Badge
                                  color={signup.status === "canceled" ? "gray" : "yellow"}
                                  variant="light"
                                  size="xs"
                                  style={{ whiteSpace: "nowrap" }}
                                >
                                  {signup.status === "canceled" ? "Storniert" : "Ausstehend"}
                                </Badge>
                              )}
                              <Tooltip label={signup.email}>
                                <ActionIcon
                                  size="sm"
                                  variant="transparent"
                                  component="a"
                                  href={`mailto:${signup.email}`}
                                >
                                  <Mail size={14} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </Group>
                          {!isPastEvent && (
                            <Box fz="xs" c="dimmed" mb={4}>
                              {signup.preferredRoleIds
                                .map(
                                  (rid) =>
                                    allRoles.find((r) => r.id === rid)?.label ?? "(gelöscht)",
                                )
                                .join(", ") || ""}
                            </Box>
                          )}
                          {(signup.mobilePhone || signup.emergencyContact) && (
                            <Box fz="xs" c="dimmed" mb={4}>
                              {signup.mobilePhone && <span>Handy: {signup.mobilePhone}</span>}
                              {signup.mobilePhone && signup.emergencyContact && " · "}
                              {signup.emergencyContact && (
                                <span>Notfall: {signup.emergencyContact}</span>
                              )}
                            </Box>
                          )}
                          {signup.note && (
                            <Box fz="xs" c="dimmed" mb={4}>
                              „{signup.note}"
                            </Box>
                          )}
                          <Group gap="xs">
                            {isPastEvent || signup.status === "canceled" ? (
                              <Badge size="sm" variant="light" color="teal">
                                {getVolunteerSignupRoleLabel(signup, shift.roles)}
                              </Badge>
                            ) : (
                              <Select
                                size="sm"
                                placeholder="Rolle zuweisen"
                                clearable
                                value={signup.assignedRoleId ?? null}
                                onChange={(val) =>
                                  assignRoleMutation.mutate({
                                    id: signup.id,
                                    assignedRoleId: val,
                                  })
                                }
                                data={shift.roles.map((r) => ({ value: r.id, label: r.label }))}
                                style={{ flex: 1 }}
                                clearSectionMode="rightSection"
                              />
                            )}
                            {signup.status !== "pending" &&
                              signup.status !== "canceled" &&
                              !isPastEvent &&
                              shiftOptions.length > 0 && (
                                <Menu>
                                  <Tooltip label="Schicht ändern">
                                    <Menu.Target>
                                      <ActionIcon size="md" variant="subtle">
                                        <ArrowLeftRight size={14} />
                                      </ActionIcon>
                                    </Menu.Target>
                                  </Tooltip>
                                  <Menu.Dropdown>
                                    {shiftOptions.map((opt) => (
                                      <Menu.Item
                                        key={opt.value}
                                        onClick={() =>
                                          moveShiftMutation.mutate({
                                            id: signup.id,
                                            shiftId: opt.value,
                                          })
                                        }
                                      >
                                        {opt.label}
                                      </Menu.Item>
                                    ))}
                                  </Menu.Dropdown>
                                </Menu>
                              )}
                            <Group gap={4} wrap="nowrap">
                              {signup.status === "pending" && (
                                <Tooltip label="Manuell bestätigen">
                                  <ActionIcon
                                    size="md"
                                    color="green"
                                    variant="subtle"
                                    onClick={() => confirmMutation.mutate(signup.id)}
                                    loading={confirmMutation.isPending}
                                  >
                                    <SquareCheckBig size={14} />
                                  </ActionIcon>
                                </Tooltip>
                              )}
                              <Tooltip label="Stornieren">
                                <ActionIcon
                                  size="md"
                                  color="red"
                                  variant="subtle"
                                  onClick={() => {
                                    if (signup.status === "canceled") {
                                      return;
                                    }
                                    if (window.confirm("Anmeldung wirklich stornieren?")) {
                                      cancelMutation.mutate(signup.id);
                                    }
                                  }}
                                  disabled={signup.status === "canceled"}
                                >
                                  <Ban size={14} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </Group>
                        </Card>
                      );
                    })}
                  </Stack>
                ) : (
                  <Table striped highlightOnHover withRowBorders>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Name</Table.Th>
                        <Table.Th>Mail</Table.Th>
                        <Table.Th>Handy</Table.Th>
                        <Table.Th>Alter</Table.Th>
                        <Table.Th>Notfall</Table.Th>
                        {!isPastEvent && <Table.Th>Bevorzugte Aufgaben</Table.Th>}
                        <Table.Th>Anmerkung</Table.Th>
                        {!isPastEvent && <Table.Th>Status</Table.Th>}
                        <Table.Th>Zugewiesene Rolle</Table.Th>
                        <Table.Th>Aktionen</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {visibleSignups.map((signup) => {
                        const preferredLabels = signup.preferredRoleIds
                          .map((rid) => allRoles.find((r) => r.id === rid)?.label ?? "(gelöscht)")
                          .join(", ");
                        const shiftOptions = event.shifts
                          .filter((s) => s.id !== signup.shiftId)
                          .map((s) => ({ value: s.id, label: s.label }));
                        const ageAtEvent = dayjs(shift.startDate).diff(
                          dayjs(signup.dateOfBirth),
                          "year",
                        );
                        const ageColor =
                          ageAtEvent >= 18 ? "green" : ageAtEvent >= 16 ? "blue" : "orange";
                        return (
                          <Table.Tr key={signup.id}>
                            <Table.Td>
                              <Tooltip
                                label={signup.association || "Keine Zugehörigkeit angegeben"}
                              >
                                <span>
                                  {signup.firstName} {signup.lastName}
                                </span>
                              </Tooltip>
                            </Table.Td>
                            <Table.Td>
                              <Tooltip label={signup.email}>
                                <ActionIcon
                                  size="sm"
                                  variant="subtle"
                                  component="a"
                                  href={`mailto:${signup.email}`}
                                >
                                  <Mail size={14} />
                                </ActionIcon>
                              </Tooltip>
                            </Table.Td>
                            <Table.Td>
                              {signup.mobilePhone ? (
                                <Text size="xs" component="a" href={`tel:${signup.mobilePhone}`}>
                                  {signup.mobilePhone}
                                </Text>
                              ) : (
                                <Text size="xs" c="dimmed">
                                  –
                                </Text>
                              )}
                            </Table.Td>
                            <Table.Td>
                              <Badge size="xs" variant="light" color={ageColor}>
                                {ageAtEvent}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              {signup.emergencyContact ? (
                                <Text
                                  size="xs"
                                  component="a"
                                  href={`tel:${signup.emergencyContact}`}
                                >
                                  {signup.emergencyContact}
                                </Text>
                              ) : (
                                <Text size="xs" c="dimmed">
                                  –
                                </Text>
                              )}
                            </Table.Td>
                            {!isPastEvent && (
                              <Table.Td>
                                {preferredLabels ? (
                                  <Text size="xs">{preferredLabels}</Text>
                                ) : (
                                  <Text size="xs" c="dimmed">
                                    –
                                  </Text>
                                )}
                              </Table.Td>
                            )}
                            <Table.Td>
                              {signup.note ? (
                                <Text size="xs">„{signup.note}"</Text>
                              ) : (
                                <Text size="xs" c="dimmed">
                                  –
                                </Text>
                              )}
                            </Table.Td>
                            {!isPastEvent && (
                              <Table.Td>
                                <Badge
                                  color={
                                    signup.status === "confirmed"
                                      ? "green"
                                      : signup.status === "canceled"
                                        ? "gray"
                                        : "yellow"
                                  }
                                  variant="light"
                                  style={{ whiteSpace: "nowrap", display: "inline-flex" }}
                                >
                                  {signup.status === "confirmed"
                                    ? "Bestätigt"
                                    : signup.status === "canceled"
                                      ? "Storniert"
                                      : "Ausstehend"}
                                </Badge>
                              </Table.Td>
                            )}
                            <Table.Td>
                              {isPastEvent || signup.status === "canceled" ? (
                                <Badge size="sm" variant="light" color="teal">
                                  {getVolunteerSignupRoleLabel(signup, shift.roles)}
                                </Badge>
                              ) : (
                                <Select
                                  size="xs"
                                  placeholder="Keine"
                                  clearable
                                  value={signup.assignedRoleId ?? null}
                                  onChange={(val) =>
                                    assignRoleMutation.mutate({
                                      id: signup.id,
                                      assignedRoleId: val,
                                    })
                                  }
                                  data={shift.roles.map((r) => ({ value: r.id, label: r.label }))}
                                  w={130}
                                  clearSectionMode="rightSection"
                                />
                              )}
                            </Table.Td>
                            <Table.Td>
                              <Group gap="xs" wrap="nowrap">
                                {!isPastEvent &&
                                  signup.status !== "canceled" &&
                                  signup.status !== "pending" &&
                                  hasMultipleShifts &&
                                  shiftOptions.length > 0 && (
                                    <Menu>
                                      <Tooltip label="Schicht ändern">
                                        <Menu.Target>
                                          <ActionIcon size="sm" variant="subtle">
                                            <ArrowLeftRight size={14} />
                                          </ActionIcon>
                                        </Menu.Target>
                                      </Tooltip>
                                      <Menu.Dropdown>
                                        {shiftOptions.map((opt) => (
                                          <Menu.Item
                                            key={opt.value}
                                            onClick={() =>
                                              moveShiftMutation.mutate({
                                                id: signup.id,
                                                shiftId: opt.value,
                                              })
                                            }
                                          >
                                            {opt.label}
                                          </Menu.Item>
                                        ))}
                                      </Menu.Dropdown>
                                    </Menu>
                                  )}
                                {signup.status === "pending" && (
                                  <Tooltip label="Manuell bestätigen">
                                    <ActionIcon
                                      size="sm"
                                      color="green"
                                      variant="subtle"
                                      onClick={() => confirmMutation.mutate(signup.id)}
                                      loading={confirmMutation.isPending}
                                    >
                                      <SquareCheckBig size={14} />
                                    </ActionIcon>
                                  </Tooltip>
                                )}
                                <Tooltip label="Stornieren">
                                  <ActionIcon
                                    size="sm"
                                    color="red"
                                    variant="subtle"
                                    onClick={() => {
                                      if (signup.status === "canceled") {
                                        return;
                                      }
                                      if (window.confirm("Anmeldung wirklich stornieren?")) {
                                        cancelMutation.mutate(signup.id);
                                      }
                                    }}
                                    disabled={signup.status === "canceled"}
                                  >
                                    <Ban size={14} />
                                  </ActionIcon>
                                </Tooltip>
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                )}
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}
    </Accordion>
  );
}
