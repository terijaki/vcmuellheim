import type { VolunteerEvent } from "@/lib/db/types";

export type RoleFormValue = {
  id: string;
  label: string;
  description: string;
  minCapacity: number;
  maxCapacity: number | null;
  minAge: number | null;
};

export type ShiftFormValue = {
  id: string;
  label: string;
  startDate: Date | null;
  endDate: Date | null;
  archivedAt?: string;
  roles: RoleFormValue[];
};

export type EventFormInitialData = {
  _sourceId: string;
  title: string;
  description: string;
  location: string;
  locationUrl: string;
  organizerName: string;
  organizerEmail: string;
  shifts: ShiftFormValue[];
};

export function buildTemplateData(source: VolunteerEvent): EventFormInitialData {
  return {
    _sourceId: source.id,
    title: source.title,
    description: source.description ?? "",
    location: source.location ?? "",
    locationUrl: source.locationUrl ?? "",
    organizerName: source.organizerName,
    organizerEmail: source.organizerEmail,
    shifts: source.shifts.map((s) => ({
      id: crypto.randomUUID(),
      label: s.label,
      startDate: null,
      endDate: null,
      roles: s.roles.map((r) => ({
        id: crypto.randomUUID(),
        label: r.label,
        description: r.description ?? "",
        minCapacity: r.minCapacity,
        maxCapacity: r.maxCapacity ?? null,
        minAge: r.minAge ?? null,
      })),
    })),
  };
}
