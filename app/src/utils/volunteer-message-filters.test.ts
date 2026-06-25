import { describe, expect, it } from "vite-plus/test";
import type { VolunteerEvent } from "@/lib/db/types";
import {
  getVolunteerMessageRoleFilterOptions,
  resolveVolunteerMessageRoleFilterValues,
} from "@/app/src/utils/volunteer-message-filters";

const event: VolunteerEvent = {
  id: "event-1",
  type: "volunteerEvent",
  title: "Test Event",
  organizerName: "Organizer",
  organizerEmail: "organizer@example.com",
  shifts: [
    {
      id: "shift-1",
      label: "Shift 1",
      startDate: "2026-06-01T10:00:00.000Z",
      endDate: "2026-06-01T14:00:00.000Z",
      roles: [
        { id: "role-a-1", label: "Task A", minCapacity: 1 },
        { id: "role-b-1", label: "Task B", minCapacity: 1 },
      ],
    },
    {
      id: "shift-2",
      label: "Shift 2",
      startDate: "2026-06-02T10:00:00.000Z",
      endDate: "2026-06-02T14:00:00.000Z",
      roles: [{ id: "role-a-2", label: "Task A", minCapacity: 1 }],
    },
  ],
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

describe("volunteer message role filter helpers", () => {
  it("groups the same task label across shifts into a single filter option", () => {
    const options = getVolunteerMessageRoleFilterOptions(event, []);

    expect(options).toEqual([
      { value: "task a", label: "Task A", roleIds: ["role-a-1", "role-a-2"] },
      { value: "task b", label: "Task B", roleIds: ["role-b-1"] },
    ]);
  });

  it("resolves grouped task selections to all matching role ids across the selected shifts", () => {
    const resolved = resolveVolunteerMessageRoleFilterValues(["task a"], event, []);

    expect(resolved).toEqual(["role-a-1", "role-a-2"]);
  });
});
