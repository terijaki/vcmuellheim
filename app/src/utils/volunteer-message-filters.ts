import type { VolunteerEvent } from "@/lib/db/types";

export type VolunteerMessageRoleFilterOption = {
  value: string;
  label: string;
  roleIds: string[];
};

export function getVolunteerMessageRoleFilterOptions(
  event: VolunteerEvent,
  shiftIds: string[],
): VolunteerMessageRoleFilterOption[] {
  const relevantShifts =
    shiftIds.length > 0 ? event.shifts.filter((s) => shiftIds.includes(s.id)) : event.shifts;

  const groupedRoles = new Map<string, string[]>();
  for (const shift of relevantShifts) {
    for (const role of shift.roles) {
      const normalizedLabel = role.label.trim().toLowerCase();
      const existingRoleIds = groupedRoles.get(normalizedLabel) ?? [];
      if (!existingRoleIds.includes(role.id)) {
        existingRoleIds.push(role.id);
      }
      groupedRoles.set(normalizedLabel, existingRoleIds);
    }
  }

  return Array.from(groupedRoles.entries())
    .map(([value, roleIds]) => ({
      value,
      label:
        roleIds.length > 0
          ? (event.shifts.flatMap((s) => s.roles).find((r) => r.id === roleIds[0])?.label ?? value)
          : value,
      roleIds,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "de"));
}

export function resolveVolunteerMessageRoleFilterValues(
  selectedRoleValues: string[],
  event: VolunteerEvent,
  shiftIds: string[],
): string[] {
  if (selectedRoleValues.length === 0) {
    return [];
  }

  const options = getVolunteerMessageRoleFilterOptions(event, shiftIds);
  const roleIds = new Set<string>();
  for (const value of selectedRoleValues) {
    const option = options.find((item) => item.value === value);
    if (option) {
      for (const roleId of option.roleIds) {
        roleIds.add(roleId);
      }
    }
  }

  return Array.from(roleIds);
}
