import { SendRawEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { VolunteerEvent, VolunteerSignup } from "@/lib/db/types";
import { sendVolunteerReceiptEmail } from "./volunteer-email";

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

		const rawMime = Buffer.from(calls[0].args[0].input.RawMessage?.Data as Uint8Array).toString("utf-8");
		expect(rawMime).toContain('Content-Type: text/calendar; charset="UTF-8"; method=PUBLISH');

		const base64Section = rawMime.split('Content-Type: text/calendar; charset="UTF-8"; method=PUBLISH')[1]?.split("\r\n\r\n")[1]?.split("\r\n\r\n--")[0];
		expect(base64Section).toBeTruthy();

		const ics = Buffer.from(base64Section ?? "", "base64").toString("utf-8");
		expect(ics).toContain("METHOD:PUBLISH");
		expect(ics).toContain("DTSTART;VALUE=DATE-TIME:20260503T080000Z");
		expect(ics).toContain("DTEND;VALUE=DATE-TIME:20260503T103000Z");
		expect(ics).not.toContain("DURATION:");
	});
});
