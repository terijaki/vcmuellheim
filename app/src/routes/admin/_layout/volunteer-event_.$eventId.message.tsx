/**
 * Admin Volunteer Event — Bulk message page
 *
 * Route: /admin/volunteer-event/$eventId/message
 *
 * Allows event organizers to compose and send a rich-text email to confirmed signups.
 * Supports filters by shift, assigned role, and date-of-birth range.
 * Deduplication by email (client-side preview + server-side send).
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  Accordion,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  MultiSelect,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { RichTextEditor } from "@mantine/tiptap";
import { Link as LinkExtension } from "@tiptap/extension-link";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useDisclosure } from "@mantine/hooks";
import { useForm } from "@tanstack/react-form-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNotification } from "@webapp/hooks/useNotification";
import {
  getVolunteerEventFn,
  listVolunteerSignupsFn,
  sendVolunteerBulkEmailFn,
} from "@webapp/server/functions/volunteer";
import dayjs from "dayjs";
import "dayjs/locale/de";
import { Send } from "lucide-react";
import { useState } from "react";
import type { DateValue } from "@mantine/dates";
import type { VolunteerEvent, VolunteerSignup } from "@/lib/db/types";
import { ButtonLink } from "@/app/src/components/CustomLink";
import {
  getVolunteerMessageRoleFilterOptions,
  resolveVolunteerMessageRoleFilterValues,
} from "@/app/src/utils/volunteer-message-filters";

dayjs.locale("de");

export const Route = createFileRoute("/admin/_layout/volunteer-event_/$eventId/message")({
  loader: async ({ params }) => {
    const [event, signupsData] = await Promise.all([
      getVolunteerEventFn({ data: { id: params.eventId } }),
      listVolunteerSignupsFn({ data: { eventId: params.eventId } }),
    ]);
    return { event, signups: signupsData.items };
  },
  component: VolunteerMessagePage,
});

function getFilteredRecipients(
  signups: VolunteerSignup[],
  filters: {
    shiftIds: string[];
    roleIds: string[];
    minDateOfBirth: string | null;
    maxDateOfBirth: string | null;
  },
): VolunteerSignup[] {
  let filtered = signups.filter((s) => s.status === "confirmed");

  if (filters.shiftIds.length > 0) {
    filtered = filtered.filter((s) => filters.shiftIds.includes(s.shiftId));
  }
  if (filters.roleIds.length > 0) {
    filtered = filtered.filter(
      (s) => s.assignedRoleId && filters.roleIds.includes(s.assignedRoleId),
    );
  }
  if (filters.minDateOfBirth) {
    filtered = filtered.filter((s) => s.dateOfBirth >= filters.minDateOfBirth!);
  }
  if (filters.maxDateOfBirth) {
    filtered = filtered.filter((s) => s.dateOfBirth <= filters.maxDateOfBirth!);
  }

  // Deduplicate by email (case-insensitive)
  const seen = new Set<string>();
  const unique: VolunteerSignup[] = [];
  for (const s of filtered) {
    const key = s.email.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(s);
    }
  }
  return unique;
}

function VolunteerMessagePage() {
  const { event: initialEvent, signups: initialSignups } = Route.useLoaderData();
  const { eventId } = Route.useParams();
  const notification = useNotification();

  const { data: event } = useQuery<VolunteerEvent>({
    queryKey: ["volunteerEvent", eventId],
    queryFn: () => getVolunteerEventFn({ data: { id: eventId } }),
    initialData: initialEvent,
  });

  const { data: signupsData } = useQuery({
    queryKey: ["volunteerSignups", eventId],
    queryFn: () => listVolunteerSignupsFn({ data: { eventId } }),
    initialData: { items: initialSignups },
  });

  const signups = signupsData.items;

  const form = useForm({
    defaultValues: {
      subject: `${event.title} - Neue Nachricht`,
      shiftIds: [] as string[],
      roleIds: [] as string[],
      minDateOfBirth: null as string | null,
      maxDateOfBirth: null as string | null,
    },
    onSubmit: () => {
      openConfirm();
    },
  });

  const [editorHasContent, setEditorHasContent] = useState(false);
  const editor = useEditor({
    extensions: [StarterKit, LinkExtension],
    content: "",
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => setEditorHasContent(e.getText().trim().length > 0),
  });

  const [confirmOpened, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);
  const [sendResult, setSendResult] = useState<{
    sent: number;
    failed: { email: string; error: string }[];
  } | null>(null);

  const sendMutation = useMutation({
    mutationFn: () => {
      const { subject, shiftIds, roleIds, minDateOfBirth, maxDateOfBirth } = form.state.values;
      const relevantShifts =
        shiftIds.length > 0 ? event.shifts.filter((s) => shiftIds.includes(s.id)) : event.shifts;
      const allRoleIds = new Set(relevantShifts.flatMap((s) => s.roles.map((r) => r.id)));
      const filteredRoleIds = resolveVolunteerMessageRoleFilterValues(
        roleIds,
        event,
        shiftIds,
      ).filter((id) => allRoleIds.has(id));
      return sendVolunteerBulkEmailFn({
        data: {
          eventId,
          subject,
          htmlBody: editor?.getHTML() ?? "",
          filters: {
            shiftIds: shiftIds.length > 0 ? shiftIds : undefined,
            roleIds: filteredRoleIds.length > 0 ? filteredRoleIds : undefined,
            minDateOfBirth: minDateOfBirth ?? undefined,
            maxDateOfBirth: maxDateOfBirth ?? undefined,
          },
        },
      });
    },
    onSuccess: (result) => {
      closeConfirm();
      setSendResult(result);
      if (result.failed.length === 0) {
        notification.success(
          `${result.sent} E-Mail${result.sent !== 1 ? "s" : ""} erfolgreich gesendet`,
        );
      } else {
        notification.error({
          message: `${result.sent} gesendet, ${result.failed.length} fehlgeschlagen`,
        });
      }
    },
    onError: () => {
      closeConfirm();
      notification.error({ message: "Nachrichten konnten nicht gesendet werden" });
    },
  });

  return (
    <form.Subscribe selector={(state) => state.values}>
      {({ shiftIds, roleIds, subject, minDateOfBirth, maxDateOfBirth }) => {
        const availableRoles = getVolunteerMessageRoleFilterOptions(event, shiftIds).map(
          (option) => ({
            value: option.value,
            label: option.label,
          }),
        );
        const validRoleValues = new Set(availableRoles.map((r) => r.value));
        const resolvedRoleIds = resolveVolunteerMessageRoleFilterValues(
          roleIds.filter((id) => validRoleValues.has(id)),
          event,
          shiftIds,
        );
        const recipients = getFilteredRecipients(signups, {
          shiftIds,
          roleIds: resolvedRoleIds,
          minDateOfBirth,
          maxDateOfBirth,
        });
        return (
          <>
            {/* Confirm modal */}
            <Modal opened={confirmOpened} onClose={closeConfirm} title="E-Mails senden?" size="sm">
              <Text size="sm">
                Bist du bereit die E-Mail zu versenden? Sie wird an{" "}
                {recipients.length === 1 ? "nur einen Empfänger" : `${recipients.length} Empfänger`}{" "}
                gesendet.
              </Text>
              <Group justify="flex-end" mt="md">
                <Button variant="subtle" onClick={closeConfirm} disabled={sendMutation.isPending}>
                  Abbrechen
                </Button>
                <Button
                  leftSection={<Send size={14} />}
                  loading={sendMutation.isPending}
                  onClick={() => sendMutation.mutate()}
                >
                  Senden
                </Button>
              </Group>
            </Modal>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void form.handleSubmit();
              }}
            >
              <Stack gap="lg">
                {/* Header */}
                <Group justify="space-between" align="flex-start">
                  <Stack gap={4}>
                    <Title order={2}>Nachricht senden</Title>
                    <Text size="sm" c="dimmed">
                      {event.title}
                    </Text>
                  </Stack>
                </Group>

                {/* Send result summary */}
                {sendResult && sendResult.failed.length > 0 && (
                  <Alert color="red" title="Teilweise fehlgeschlagen">
                    <Stack gap="xs">
                      <Text size="sm">
                        {sendResult.sent} gesendet, {sendResult.failed.length} fehlgeschlagen:
                      </Text>
                      {sendResult.failed.map(
                        ({ email, error }: { email: string; error: string }) => (
                          <Text key={email} size="xs" c="red">
                            {email}: {error}
                          </Text>
                        ),
                      )}
                    </Stack>
                  </Alert>
                )}

                {/* Filters */}

                <Accordion variant="contained" bg="white">
                  <Accordion.Item value="filters">
                    <Accordion.Control>Empfänger filtern</Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="sm">
                        <form.Field name="shiftIds">
                          {(field) => (
                            <MultiSelect
                              label="Schichten"
                              placeholder="Alle Schichten"
                              data={event.shifts.map((s) => ({ value: s.id, label: s.label }))}
                              value={field.state.value}
                              onChange={(val) => {
                                field.handleChange(val);
                                const newValidRoleValues = new Set(
                                  getVolunteerMessageRoleFilterOptions(event, val).map(
                                    (option) => option.value,
                                  ),
                                );
                                form.setFieldValue(
                                  "roleIds",
                                  form
                                    .getFieldValue("roleIds")
                                    .filter((value) => newValidRoleValues.has(value)),
                                );
                              }}
                              clearable
                            />
                          )}
                        </form.Field>
                        <form.Field name="roleIds">
                          {(field) => (
                            <MultiSelect
                              label="Aufgaben"
                              placeholder="Alle Aufgaben"
                              data={availableRoles}
                              value={field.state.value.filter((value) =>
                                validRoleValues.has(value),
                              )}
                              onChange={field.handleChange}
                              clearable
                              disabled={availableRoles.length === 0}
                            />
                          )}
                        </form.Field>
                        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                          <form.Field name="maxDateOfBirth">
                            {(field) => (
                              <DatePickerInput
                                label="Geboren vor"
                                defaultLevel="decade"
                                placeholder="z.B. min 18 Jahre"
                                value={field.state.value}
                                onChange={(val) =>
                                  field.handleChange(val ? dayjs(val).format("YYYY-MM-DD") : null)
                                }
                                locale="de"
                                valueFormat="DD.MM.YYYY"
                                clearable
                                minDate={dayjs().subtract(90, "year").toDate()}
                                maxDate={dayjs().subtract(9, "year").toDate()}
                              />
                            )}
                          </form.Field>
                          <form.Field name="minDateOfBirth">
                            {(field) => (
                              <DatePickerInput
                                label="Geboren nach"
                                defaultLevel="decade"
                                placeholder="z.B. nur U16"
                                value={field.state.value as DateValue}
                                onChange={(val) =>
                                  field.handleChange(val ? dayjs(val).format("YYYY-MM-DD") : null)
                                }
                                locale="de"
                                valueFormat="DD.MM.YYYY"
                                clearable
                                minDate={dayjs().subtract(18, "year").toDate()}
                                maxDate={dayjs().subtract(9, "year").toDate()}
                              />
                            )}
                          </form.Field>
                        </SimpleGrid>
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                </Accordion>

                {/* Recipient preview */}
                <Card withBorder>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text fw={500} size="sm">
                        Empfänger
                      </Text>
                      <Badge variant="light" color={recipients.length > 0 ? "blue" : "gray"}>
                        {recipients.length} Empfänger
                      </Badge>
                    </Group>
                    {recipients.length === 0 ? (
                      <Text size="sm" c="dimmed">
                        Keine bestätigten Anmeldungen für diese Filter.
                      </Text>
                    ) : (
                      <ScrollArea.Autosize mah={160}>
                        <Group gap="xs" wrap="wrap">
                          {recipients.map((r) => (
                            <Badge key={r.id} size="sm" variant="outline">
                              {r.firstName} {r.lastName}
                            </Badge>
                          ))}
                        </Group>
                      </ScrollArea.Autosize>
                    )}
                  </Stack>
                </Card>

                {/* Compose */}
                <Card withBorder>
                  <Stack gap="md">
                    <Text fw={500} size="sm">
                      Nachricht verfassen
                    </Text>
                    <form.Field name="subject">
                      {(field) => (
                        <TextInput
                          label="Betreff"
                          required
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                        />
                      )}
                    </form.Field>
                    <Box>
                      <Text size="sm" fw={500} mb="xs">
                        Inhalt
                      </Text>
                      <RichTextEditor editor={editor} variant="subtle">
                        <RichTextEditor.Toolbar sticky stickyOffset={60}>
                          <RichTextEditor.ControlsGroup>
                            <RichTextEditor.Bold />
                            <RichTextEditor.Italic />
                            <RichTextEditor.ClearFormatting />
                          </RichTextEditor.ControlsGroup>
                          <RichTextEditor.ControlsGroup>
                            <RichTextEditor.BulletList />
                            <RichTextEditor.OrderedList />
                          </RichTextEditor.ControlsGroup>
                          <RichTextEditor.ControlsGroup>
                            <RichTextEditor.Link />
                            <RichTextEditor.Unlink />
                          </RichTextEditor.ControlsGroup>
                        </RichTextEditor.Toolbar>
                        <RichTextEditor.Content />
                      </RichTextEditor>
                    </Box>
                    {sendMutation.isPending && (
                      <Group gap="xs">
                        <Loader size="xs" />
                        <Text size="sm" c="dimmed">
                          E-Mails werden gesendet…
                        </Text>
                      </Group>
                    )}
                    <Group justify="flex-end" gap="sm">
                      <ButtonLink variant="subtle" to="/admin/volunteer-event">
                        Abbrechen
                      </ButtonLink>
                      <Button
                        type="submit"
                        leftSection={<Send size={16} />}
                        disabled={
                          subject.trim().length === 0 ||
                          !editorHasContent ||
                          recipients.length === 0
                        }
                      >
                        Senden
                      </Button>
                    </Group>
                  </Stack>
                </Card>
              </Stack>
            </form>
          </>
        );
      }}
    </form.Subscribe>
  );
}
