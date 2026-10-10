import { describe, expect, it } from "vite-plus/test";
import dayjs from "dayjs";
import "dayjs/locale/de";
import {
  formatShiftDateRange,
  formatVolunteerTShirtSize,
  getVolunteerEventGroup,
  getVolunteerSignupRoleLabel,
  sanitizeVolunteerPhoneNumber,
} from "./volunteer";
import { volunteerTShirtSizeSchema } from "@/lib/db/schemas";

dayjs.locale("de");

describe("formatShiftDateRange", () => {
  it("returns only start when no end date is given", () => {
    const result = formatShiftDateRange("2025-04-19T12:00:00");
    expect(result).toBe("Samstag, 19. April 2025 um 12:00 Uhr");
  });

  it("returns only start when end date is null", () => {
    const result = formatShiftDateRange("2025-04-19T12:00:00", null);
    expect(result).toBe("Samstag, 19. April 2025 um 12:00 Uhr");
  });

  it("formats same-day range with 'bis' and only end time", () => {
    const result = formatShiftDateRange("2025-04-19T12:00:00", "2025-04-19T16:00:00");
    expect(result).toBe("Samstag, 19. April 2025, 12:00 Uhr bis 16:00 Uhr");
  });

  it("formats multi-day range with em-dash and full end date", () => {
    const result = formatShiftDateRange("2025-04-19T12:00:00", "2025-04-20T16:00:00");
    expect(result).toBe("Samstag, 19. April 2025 um 12:00 Uhr – Sonntag, 20. April um 16:00 Uhr");
  });
});

describe("sanitizeVolunteerPhoneNumber", () => {
  it("removes whitespace from phone numbers", () => {
    expect(sanitizeVolunteerPhoneNumber("0176 1234 5678")).toBe("017612345678");
    expect(sanitizeVolunteerPhoneNumber("+49 151 1234 5678")).toBe("+4915112345678");
  });

  it("returns undefined for empty values", () => {
    expect(sanitizeVolunteerPhoneNumber(undefined)).toBeUndefined();
    expect(sanitizeVolunteerPhoneNumber("")).toBeUndefined();
  });
});

describe("formatVolunteerTShirtSize", () => {
  it("adds a Kinder hint for kids sizes", () => {
    expect(formatVolunteerTShirtSize("128")).toBe("128 (Kinder)");
    expect(formatVolunteerTShirtSize("164")).toBe("164 (Kinder)");
  });

  it("returns adult sizes unchanged", () => {
    expect(formatVolunteerTShirtSize("M")).toBe("M");
    expect(formatVolunteerTShirtSize("3XL")).toBe("3XL");
  });
});

describe("volunteerTShirtSizeSchema", () => {
  it("accepts kids and adult sizes", () => {
    expect(volunteerTShirtSizeSchema.parse("140")).toBe("140");
    expect(volunteerTShirtSizeSchema.parse("XL")).toBe("XL");
  });

  it("rejects free-form and unknown sizes", () => {
    expect(() => volunteerTShirtSizeSchema.parse("medium")).toThrow();
    expect(() => volunteerTShirtSizeSchema.parse("110")).toThrow();
    expect(() => volunteerTShirtSizeSchema.parse("free text")).toThrow();
  });
});

describe("getVolunteerSignupRoleLabel", () => {
  it("returns the matching role label for an assigned signup", () => {
    expect(
      getVolunteerSignupRoleLabel({ assignedRoleId: "role-2" }, [
        { id: "role-1", label: "Kasse" },
        { id: "role-2", label: "Check-in" },
      ]),
    ).toBe("Check-in");
  });

  it("falls back to a neutral label when no role is assigned", () => {
    expect(
      getVolunteerSignupRoleLabel({ assignedRoleId: null }, [{ id: "role-1", label: "Kasse" }]),
    ).toBe("Keine");
  });
});

describe("getVolunteerEventGroup", () => {
  const shift = {
    id: "shift-1",
    label: "Schicht",
    startDate: "2025-04-19T12:00:00",
    endDate: "2025-04-19T16:00:00",
    roles: [],
  };

  it("returns archived for archived events", () => {
    expect(
      getVolunteerEventGroup(
        { archivedAt: "2025-04-19T12:00:00", shifts: [shift] },
        "2025-04-20T10:00:00",
      ),
    ).toBe("archived");
  });

  it("returns past when the latest shift has already ended", () => {
    expect(getVolunteerEventGroup({ shifts: [shift] }, "2025-04-20T10:00:00")).toBe("past");
  });

  it("returns active when the latest shift is still upcoming", () => {
    expect(getVolunteerEventGroup({ shifts: [shift] }, "2025-04-18T10:00:00")).toBe("active");
  });
});
