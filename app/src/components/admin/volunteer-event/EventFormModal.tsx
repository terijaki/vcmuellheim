import {
  Box,
  Button,
  Divider,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { RichTextEditor } from "@mantine/tiptap";
import { Link as LinkExtension } from "@tiptap/extension-link";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useForm } from "@tanstack/react-form-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNotification } from "@webapp/hooks/useNotification";
import {
  createVolunteerEventFn,
  listVolunteerSignupsFn,
  updateVolunteerEventFn,
} from "@webapp/server/functions/volunteer";
import { useEffect, useMemo, useState } from "react";
import type { VolunteerEvent } from "@/lib/db/types";
import { ShiftsManager } from "./ShiftsManager";
import type { EventFormInitialData, ShiftFormValue } from "./types";

function serializeShifts(shifts: ShiftFormValue[]): VolunteerEvent["shifts"] {
  return shifts.map((s, index) => {
    if (!s.startDate) {
      throw new Error(
        `Shift ${index + 1}${s.label ? ` (${s.label})` : ""} is missing a start date.`,
      );
    }

    return {
      id: s.id,
      label: s.label,
      startDate: s.startDate.toISOString(),
      endDate: s.endDate?.toISOString() ?? undefined,
      ...(s.archivedAt ? { archivedAt: s.archivedAt } : {}),
      roles: s.roles.map(({ minAge, maxCapacity, ...r }) => ({
        ...r,
        ...(maxCapacity !== null ? { maxCapacity } : {}),
        ...(minAge !== null && minAge > 0 ? { minAge } : {}),
      })),
    };
  });
}

function deserializeShifts(shifts: VolunteerEvent["shifts"]): ShiftFormValue[] {
  return shifts.map((s) => ({
    id: s.id,
    label: s.label,
    startDate: new Date(s.startDate),
    endDate: s.endDate ? new Date(s.endDate) : null,
    archivedAt: s.archivedAt,
    roles: s.roles.map((r) => ({
      ...r,
      description: r.description ?? "",
      maxCapacity: r.maxCapacity ?? null,
      minAge: r.minAge ?? null,
    })),
  }));
}

export function EventFormModal({
  opened,
  onClose,
  editingEvent,
  onSaved,
  initialData,
}: {
  opened: boolean;
  onClose: () => void;
  editingEvent: VolunteerEvent | null;
  onSaved: () => void;
  initialData?: EventFormInitialData;
}) {
  const notification = useNotification();
  const isMobile = useMediaQuery("(max-width: 48em)");

  const editor = useEditor({
    extensions: [StarterKit, LinkExtension],
    content: editingEvent?.description ?? initialData?.description ?? "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      form.setFieldValue("description", editor.getHTML());
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof createVolunteerEventFn>[0]["data"]) =>
      createVolunteerEventFn({ data }),
    onSuccess: () => {
      onSaved();
      onClose();
      notification.success("Helfereinsatz wurde erstellt");
    },
    onError: () => notification.error({ message: "Helfereinsatz konnte nicht erstellt werden" }),
  });

  const updateMutation = useMutation({
    mutationFn: (args: {
      id: string;
      data: Parameters<typeof updateVolunteerEventFn>[0]["data"]["data"];
    }) => updateVolunteerEventFn({ data: args }),
    onSuccess: () => {
      onSaved();
      onClose();
      notification.success("Helfereinsatz wurde aktualisiert");
    },
    onError: () =>
      notification.error({ message: "Helfereinsatz konnte nicht aktualisiert werden" }),
  });

  const [shifts, setShifts] = useState<ShiftFormValue[]>(() => {
    if (editingEvent) return deserializeShifts(editingEvent.shifts);
    if (initialData) return initialData.shifts;
    return [];
  });

  const { data: signupsForForm } = useQuery({
    queryKey: ["volunteerSignups", editingEvent?.id, "forShiftManager"],
    queryFn: () => listVolunteerSignupsFn({ data: { eventId: editingEvent!.id } }),
    enabled: !!editingEvent,
  });

  const signupCountsByShiftId = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const signup of signupsForForm?.items ?? []) {
      counts[signup.shiftId] = (counts[signup.shiftId] ?? 0) + 1;
    }
    return counts;
  }, [signupsForForm]);

  useEffect(() => {
    editor?.commands.setContent(editingEvent?.description ?? initialData?.description ?? "");
  }, [editingEvent, initialData, editor]);

  const form = useForm({
    defaultValues: {
      title: editingEvent?.title ?? initialData?.title ?? "",
      description: editingEvent?.description ?? initialData?.description ?? "",
      location: editingEvent?.location ?? initialData?.location ?? "",
      locationUrl: editingEvent?.locationUrl ?? initialData?.locationUrl ?? "",
      organizerName: editingEvent?.organizerName ?? initialData?.organizerName ?? "",
      organizerEmail: editingEvent?.organizerEmail ?? initialData?.organizerEmail ?? "",
    },
    onSubmit: async ({ value }) => {
      const serializedShifts = serializeShifts(shifts);
      if (editingEvent) {
        updateMutation.mutate({
          id: editingEvent.id,
          data: {
            type: "volunteerEvent",
            title: value.title,
            description: value.description || undefined,
            location: value.location || undefined,
            locationUrl: value.locationUrl || undefined,
            organizerName: value.organizerName,
            organizerEmail: value.organizerEmail,
            shifts: serializedShifts,
          },
        });
      } else {
        createMutation.mutate({
          type: "volunteerEvent",
          title: value.title,
          description: value.description || undefined,
          location: value.location || undefined,
          locationUrl: value.locationUrl || undefined,
          organizerName: value.organizerName,
          organizerEmail: value.organizerEmail,
          shifts: serializedShifts,
        });
      }
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editingEvent ? "Helfereinsatz bearbeiten" : "Neuer Helfereinsatz"}
      size="xl"
      fullScreen={isMobile}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <Stack gap="md">
          <form.Field name="title">
            {(field) => (
              <TextInput
                label="Titel"
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            )}
          </form.Field>
          <Box>
            <Text size="sm" fw={500} mb="xs">
              Beschreibung (optional)
            </Text>
            <RichTextEditor
              editor={editor}
              variant="subtle"
              styles={{ content: { "& .ProseMirror": { minHeight: 100 } } }}
            >
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

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <form.Field name="location">
              {(field) => (
                <TextInput
                  label="Ort (optional)"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              )}
            </form.Field>
            <form.Field name="locationUrl">
              {(field) => (
                <TextInput
                  label="Link zum Ort (optional)"
                  placeholder="https://maps.google.com/..."
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              )}
            </form.Field>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <form.Field name="organizerName">
              {(field) => (
                <TextInput
                  label="Veranstalter Name"
                  required
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              )}
            </form.Field>
            <form.Field name="organizerEmail">
              {(field) => (
                <TextInput
                  label="Veranstalter E-Mail"
                  required
                  type="email"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              )}
            </form.Field>
          </SimpleGrid>
          <Divider label="Schichten" />
          <ShiftsManager
            shifts={shifts}
            onShiftsChange={setShifts}
            signupCountsByShiftId={signupCountsByShiftId}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={onClose} disabled={isPending}>
              Abbrechen
            </Button>
            <Button type="submit" loading={isPending}>
              {editingEvent ? "Speichern" : "Erstellen"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
