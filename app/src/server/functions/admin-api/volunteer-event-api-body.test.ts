import samplePayload from "./fixtures/volunteer-event-sample-payload.json";
import { describe, expect, it } from "vite-plus/test";
import {
  parseVolunteerEventCreateBody,
  prepareVolunteerEventCreateInput,
} from "../volunteer.server";

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
});
