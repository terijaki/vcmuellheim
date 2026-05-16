import { SendEmailCommand, SendRawEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { VolunteerEvent, VolunteerSignup } from "@/lib/db/types";
import {
  sendVolunteerOrganizerNotificationEmail,
  sendVolunteerReceiptEmail,
} from "./volunteer-email";

const sesMock = mockClient(SESClient);
let previousAppBaseUrl: string | undefined;

const event: VolunteerEvent = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  type: "volunteerEvent",
  title: "Stadtfest 2026",
  organizerName: "Max Muster",
  organizerEmail: "veranstalter@example.com",
  location: "Sporthalle",
  shifts: [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      label: "Aufbau",
      startDate: "2026-05-03T08:00:00.000Z",
      endDate: "2026-05-03T10:30:00.000Z",
      roles: [],
    },
  ],
  createdAt: "2026-04-21T00:00:00.000Z",
  updatedAt: "2026-04-21T00:00:00.000Z",
};

const signup: VolunteerSignup = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  type: "volunteerSignup",
  status: "confirmed",
  firstName: "Erika",
  lastName: "Musterfrau",
  email: "erika@example.com",
  dateOfBirth: "1990-01-15",
  preferredRoleIds: [],
  association: "Mitglied",
  eventId: event.id,
  shiftId: event.shifts[0].id,
  createdAt: "2026-04-21T00:00:00.000Z",
  updatedAt: "2026-04-21T00:00:00.000Z",
};

beforeEach(() => {
  previousAppBaseUrl = process.env.APP_BASE_URL;
  process.env.APP_BASE_URL = "https://test.vcmuellheim.de";
  sesMock.reset();
  sesMock.on(SendRawEmailCommand).resolves({ MessageId: "m-1" });
});

afterEach(() => {
  if (previousAppBaseUrl === undefined) {
    delete process.env.APP_BASE_URL;
    return;
  }
  process.env.APP_BASE_URL = previousAppBaseUrl;
});

describe("sendVolunteerReceiptEmail", () => {
  it("sends ICS attachment as PUBLISH with explicit DTEND", async () => {
    await sendVolunteerReceiptEmail({ signup, event });

    const calls = sesMock.commandCalls(SendRawEmailCommand);
    expect(calls).toHaveLength(1);

    const rawMime = Buffer.from(calls[0].args[0].input.RawMessage?.Data as Uint8Array).toString(
      "utf-8",
    );
    const boundaryMatch = rawMime.match(/Content-Type: multipart\/mixed; boundary="([^"]+)"/);
    expect(boundaryMatch).toBeTruthy();

    const boundary = boundaryMatch?.[1] ?? "";
    const mimeParts = rawMime
      .split(`--${boundary}`)
      .map((part) => part.trim())
      .filter((part) => part.length > 0 && part !== "--");
    const calendarPart = mimeParts.find(
      (part) => part.includes("Content-Type: text/calendar;") && part.includes("method=PUBLISH"),
    );
    expect(calendarPart).toBeTruthy();
    expect(calendarPart ?? "").toContain(
      'Content-Type: text/calendar; charset="UTF-8"; method=PUBLISH',
    );

    const [calendarHeaders = "", ...calendarBodyParts] = (calendarPart ?? "").split("\r\n\r\n");
    expect(calendarHeaders).toContain("Content-Transfer-Encoding: base64");
    const base64Section = calendarBodyParts.join("\r\n\r\n").replaceAll("\r\n", "").trim();
    expect(base64Section).toBeTruthy();

    const ics = Buffer.from(base64Section, "base64").toString("utf-8");
    expect(ics).toContain("METHOD:PUBLISH");
    expect(ics).toMatch(/(?:^|\r\n)DTSTART(?:;VALUE=DATE-TIME)?:20260503T080000Z(?:\r\n|$)/);
    expect(ics).toMatch(/(?:^|\r\n)DTEND(?:;VALUE=DATE-TIME)?:20260503T103000Z(?:\r\n|$)/);
    expect(ics).not.toContain("DURATION:");
  });
});

describe("sendVolunteerOrganizerNotificationEmail", () => {
  it("sends organizer notification with assigned role details", async () => {
    const assignedSignup: VolunteerSignup = {
      ...signup,
      assignedRoleId: "role-theke",
    };
    const assignedEvent: VolunteerEvent = {
      ...event,
      shifts: [
        {
          ...event.shifts[0],
          roles: [
            {
              id: "role-theke",
              label: "Theke",
              minCapacity: 1,
            },
          ],
        },
      ],
    };

    await sendVolunteerOrganizerNotificationEmail({ signup: assignedSignup, event: assignedEvent });

    const calls = sesMock.commandCalls(SendEmailCommand);
    expect(calls).toHaveLength(1);

    const input = calls[0].args[0].input;
    expect(input.Destination?.ToAddresses).toEqual([event.organizerEmail]);
    expect(input.ReplyToAddresses).toEqual([signup.email]);
    expect(input.Message?.Subject?.Data).toContain("Neue Anmeldung von");
    const html = input.Message?.Body?.Html?.Data ?? "";
    expect(html).toContain("Erika Musterfrau");
    expect(html).toContain("Theke");
    expect(html).toContain("erika@example.com");
  });

  it("uses fallback wording when no assigned role exists", async () => {
    const signupWithoutAssignment: VolunteerSignup = {
      ...signup,
      assignedRoleId: undefined,
    };

    await sendVolunteerOrganizerNotificationEmail({ signup: signupWithoutAssignment, event });

    const calls = sesMock.commandCalls(SendEmailCommand);
    expect(calls).toHaveLength(1);

    const input = calls[0].args[0].input;
    const html = input.Message?.Body?.Html?.Data ?? "";
    expect(html).toContain("Noch nicht zugewiesen");
  });

  it("escapes interpolated values in organizer notification HTML", async () => {
    const unsafeSignup: VolunteerSignup = {
      ...signup,
      firstName: "<img src=x onerror=alert(1)>",
      lastName: "O'Connor & <script>alert(1)</script>",
      email: 'xss+"test"@example.com',
      assignedRoleId: "role-unsafe",
    };
    const unsafeEvent: VolunteerEvent = {
      ...event,
      title: "Fest <b>2026</b> & Co",
      shifts: [
        {
          ...event.shifts[0],
          label: "Aufbau <i>fruh</i>",
          roles: [
            {
              id: "role-unsafe",
              label: "Theke <script>",
              minCapacity: 1,
            },
          ],
        },
      ],
    };

    await sendVolunteerOrganizerNotificationEmail({ signup: unsafeSignup, event: unsafeEvent });

    const calls = sesMock.commandCalls(SendEmailCommand);
    expect(calls).toHaveLength(1);
    const html = calls[0].args[0].input.Message?.Body?.Html?.Data ?? "";

    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("O&#39;Connor &amp; &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("xss+&quot;test&quot;@example.com");
    expect(html).toContain("Fest &lt;b&gt;2026&lt;/b&gt; &amp; Co");
    expect(html).toContain("Aufbau &lt;i&gt;fruh&lt;/i&gt;");
    expect(html).toContain("Theke &lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});
