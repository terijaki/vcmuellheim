import samplePayload from "./fixtures/volunteer-event-sample-payload.json";
import { describe, expect, it } from "vite-plus/test";
import {
  normalizeVolunteerEventShiftsForUpdate,
  parseVolunteerEventCreateBody,
  parseVolunteerEventUpdateBody,
  prepareVolunteerEventCreateInput,
  validateVolunteerEventShiftIdsForUpdate,
  VolunteerEventUpdateInvalidIdsError,
} from "../volunteer.server";

const eventId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const shiftId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const shiftId2 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const roleId1 = "11111111-1111-4111-8111-111111111111";
const roleId2 = "22222222-2222-4222-8222-222222222222";
const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

const currentEvent = {
  id: eventId,
  type: "volunteerEvent" as const,
  title: "Stadtfest",
  organizerName: "Organizer",
  organizerEmail: "org@example.com",
  shifts: [
    {
      id: shiftId,
      label: "Aufbau",
      startDate: futureDate,
      roles: [
        { id: roleId1, label: "Theke", minCapacity: 1, maxCapacity: 3 },
        { id: roleId2, label: "Einlass", minCapacity: 1, maxCapacity: 2 },
      ],
    },
    {
      id: shiftId2,
      label: "Betrieb",
      startDate: futureDate,
      roles: [],
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("volunteer event API request bodies", () => {
  it("parses and prepares the Stadtfest sample fixture", () => {
    const parsed = parseVolunteerEventCreateBody(samplePayload);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const prepared = prepareVolunteerEventCreateInput(parsed.data);
    expect(prepared.shifts).toHaveLength(10);
    const roleCount = prepared.shifts.reduce((sum, shift) => sum + shift.roles.length, 0);
    expect(roleCount).toBe(56);
    const sampleShiftIds = new Set(samplePayload.shifts.map((s) => s.id));
    const sampleRoleIds = new Set(samplePayload.shifts.flatMap((s) => s.roles.map((r) => r.id)));
    for (const shift of prepared.shifts) {
      expect(sampleShiftIds.has(shift.id)).toBe(false);
      for (const role of shift.roles) {
        expect(sampleRoleIds.has(role.id)).toBe(false);
      }
    }
  });

  it("rejects empty PATCH bodies", () => {
    const parsed = parseVolunteerEventUpdateBody({});
    expect(parsed.success).toBe(false);
  });

  it("accepts partial scalar PATCH fields", () => {
    const parsed = parseVolunteerEventUpdateBody({ title: "Neu" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.title).toBe("Neu");
    expect(parsed.data.shifts).toBeUndefined();
  });

  it("assigns ids in normalizeVolunteerEventShiftsForUpdate when omitted", () => {
    const normalized = normalizeVolunteerEventShiftsForUpdate([
      {
        label: "Neu",
        startDate: futureDate,
        roles: [{ label: "Helfer", minCapacity: 1 }],
      },
    ]);
    expect(normalized[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(normalized[0]?.roles[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("preserves existing ids in normalizeVolunteerEventShiftsForUpdate", () => {
    const normalized = normalizeVolunteerEventShiftsForUpdate([
      {
        id: shiftId,
        label: "Aufbau",
        startDate: futureDate,
        roles: [{ id: roleId1, label: "Theke", minCapacity: 1 }],
      },
    ]);
    expect(normalized[0]?.id).toBe(shiftId);
    expect(normalized[0]?.roles[0]?.id).toBe(roleId1);
  });

  it("rejects unknown shift ids", () => {
    expect(() =>
      validateVolunteerEventShiftIdsForUpdate(currentEvent, [
        {
          id: "33333333-3333-4333-8333-333333333333",
          label: "X",
          startDate: futureDate,
          roles: [],
        },
      ]),
    ).toThrow(VolunteerEventUpdateInvalidIdsError);
  });

  it("rejects a role id attached to the wrong shift", () => {
    expect(() =>
      validateVolunteerEventShiftIdsForUpdate(currentEvent, [
        {
          id: shiftId2,
          label: "Betrieb",
          startDate: futureDate,
          roles: [{ id: roleId1, label: "Theke", minCapacity: 1 }],
        },
      ]),
    ).toThrow(VolunteerEventUpdateInvalidIdsError);
  });

  it("rejects duplicate role ids across shifts", () => {
    expect(() =>
      validateVolunteerEventShiftIdsForUpdate(currentEvent, [
        {
          id: shiftId,
          label: "Aufbau",
          startDate: futureDate,
          roles: [
            { id: roleId1, label: "Theke", minCapacity: 1 },
            { id: roleId1, label: "Dup", minCapacity: 1 },
          ],
        },
      ]),
    ).toThrow(VolunteerEventUpdateInvalidIdsError);
  });
});
