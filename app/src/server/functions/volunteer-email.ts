/**
 * Email helpers for the Volunteer Event Planner feature.
 *
 * - Confirmation email: sent on signup, contains a verification link (72 h TTL).
 * - Receipt email: sent after token verification, includes a .ics calendar attachment.
 *
 * Both emails are written in German and use AWS SES via the @aws-sdk/client-ses package.
 */

import { SendEmailCommand, SendRawEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { Club, Mail } from "@project.config";
import { getRouter } from "@webapp/router";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { generateIcsCalendar, type IcsEvent } from "ts-ics";
import type { VolunteerEvent, VolunteerSignup } from "@/lib/db/types";

dayjs.extend(utc);
dayjs.extend(timezone);

const isProd = process.env.CDK_ENVIRONMENT === "prod";

function getSesClient(): SESClient {
	return new SESClient({ region: process.env.AWS_REGION ?? "eu-central-1" });
}

function fromEmail(): string {
	return isProd ? Mail.prod.systemFromEmail : Mail.dev.systemFromEmail;
}

function appBaseUrl(): string {
	return isProd ? `https://${Club.domain}` : `https://new.${Club.domain}`;
}

// ---------------------------------------------------------------------------
// ICS generation
// ---------------------------------------------------------------------------

function buildIcsAttachment(event: VolunteerEvent, shiftId: string): string {
	const shift = event.shifts.find((s) => s.id === shiftId);
	if (!shift) return "";

	const start = dayjs(shift.startDate);
	const end = shift.endDate ? dayjs(shift.endDate) : start.add(6, "hour");
	const durationMinutes = end.diff(start, "minute");
	const durationHours = Math.floor(durationMinutes / 60);
	const remainingMinutes = durationMinutes % 60;

	const icsEvent: IcsEvent = {
		uid: `volunteer-signup-${shiftId}@${Club.domain}`,
		summary: `${event.title} – ${shift.label}`,
		start: { date: start.toDate(), type: "DATE-TIME" },
		duration: remainingMinutes > 0 ? { hours: durationHours, minutes: remainingMinutes } : { hours: durationHours || 6 },
		stamp: { date: new Date(), type: "DATE-TIME" },
		description: `${event.title}\nVeranstaltungsseite: ${appBaseUrl()}${getRouter().buildLocation({ to: "/e/$uuid", params: { uuid: event.id } }).href}`,

		location: event.location ?? "",
	};

	const calendar = generateIcsCalendar({ version: "2.0", prodId: `-//${Club.name}//DE`, events: [icsEvent] });
	return calendar;
}

// ---------------------------------------------------------------------------
// HTML templates
// ---------------------------------------------------------------------------

function buildConfirmationHtml(opts: { firstName: string; shiftLabel: string; shiftDate: string; eventTitle: string; confirmationUrl: string }): string {
	const { firstName, shiftLabel, shiftDate, eventTitle, confirmationUrl } = opts;
	return `<p>Hallo ${firstName},</p>
<p>danke für deine Anmeldung als Helfer:in bei <strong>${eventTitle}</strong>!</p>
<p>Du hast dich für den Einsatz <strong>${shiftLabel}</strong> am <strong>${shiftDate}</strong> angemeldet.</p>
<p>Bitte bestätige deine Anmeldung innerhalb von 72 Stunden über den folgenden Link:</p>
<p>
  <a href="${confirmationUrl}" target="_blank" rel="noopener noreferrer"
     style="display:inline-block;padding:12px 24px;background:#2196f3;color:white;text-decoration:none;border-radius:4px;font-weight:bold;">
    Anmeldung bestätigen
  </a>
</p>
<p>Oder kopiere diesen Link in deinen Browser:</p>
<p>${confirmationUrl}</p>
<p><em>Dieser Link ist 72 Stunden gültig.</em></p>
<p>Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.</p>
<p>Sportliche Grüße,<br>${Club.shortName}</p>`;
}

function buildReceiptHtml(opts: {
	firstName: string;
	eventTitle: string;
	eventDescription: string | undefined;
	eventLocation: string | undefined;
	shiftLabel: string;
	shiftDate: string;
	eventUrl: string;
}): string {
	const { firstName, eventTitle, eventDescription, eventLocation, shiftLabel, shiftDate, eventUrl } = opts;
	const locationLine = eventLocation ? `<p><strong>Ort:</strong> ${eventLocation}</p>` : "";
	const descriptionLine = eventDescription ? `<p>${eventDescription}</p>` : "";
	return `<p>Hallo ${firstName},</p>
<p>deine Anmeldung als Helfer:in wurde bestätigt. Vielen Dank!</p>
<h2>${eventTitle}</h2>
${descriptionLine}
${locationLine}
<p><strong>Einsatz:</strong> ${shiftLabel}</p>
<p><strong>Datum / Uhrzeit:</strong> ${shiftDate}</p>
<p>Den Termin findest du auch als Kalender-Anhang (.ics) in dieser E-Mail.</p>
<p><a href="${eventUrl}" target="_blank" rel="noopener noreferrer">Zur Veranstaltungsseite</a></p>
<p>Sportliche Grüße,<br>${Club.shortName}</p>`;
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

function formatShiftDate(shift: VolunteerEvent["shifts"][number]): string {
	const start = dayjs(shift.startDate).tz("Europe/Berlin");
	const formatted = start.format("dddd, D. MMMM YYYY [um] HH:mm [Uhr]");
	return formatted;
}

/** Send the confirmation email (no attachment). */
export async function sendVolunteerConfirmationEmail(opts: { toEmail: string; firstName: string; event: VolunteerEvent; shiftId: string; tokenId: string }): Promise<void> {
	const { toEmail, firstName, event, shiftId, tokenId } = opts;

	const shift = event.shifts.find((s) => s.id === shiftId);
	if (!shift) throw new Error(`Shift ${shiftId} not found on event ${event.id}`);

	const router = getRouter();
	const location = router.buildLocation({ to: "/e/$uuid", params: { uuid: event.id }, search: { token: tokenId } });
	const confirmationUrl = `${appBaseUrl()}${location.href}`;
	const shiftDate = formatShiftDate(shift);

	const html = buildConfirmationHtml({
		firstName,
		shiftLabel: shift.label,
		shiftDate,
		eventTitle: event.title,
		confirmationUrl,
	});

	const ses = getSesClient();
	await ses.send(
		new SendEmailCommand({
			Source: fromEmail(),
			Destination: { ToAddresses: [toEmail] },
			Message: {
				Subject: { Data: `Anmeldung bestätigen: ${event.title}`, Charset: "UTF-8" },
				Body: {
					Html: { Data: html, Charset: "UTF-8" },
					Text: {
						Data: `Hallo ${firstName},\n\nBitte bestätige deine Anmeldung: ${confirmationUrl}\n\nDieser Link ist 72 Stunden gültig.\n\n${Club.shortName}`,
						Charset: "UTF-8",
					},
				},
			},
		}),
	);
}

/** Send the receipt email with a .ics calendar attachment. */
export async function sendVolunteerReceiptEmail(opts: { signup: VolunteerSignup; event: VolunteerEvent }): Promise<void> {
	const { signup, event } = opts;

	const shift = event.shifts.find((s) => s.id === signup.shiftId);
	if (!shift) throw new Error(`Shift ${signup.shiftId} not found on event ${event.id}`);

	const icsContent = buildIcsAttachment(event, signup.shiftId);
	const eventUrl = `${appBaseUrl()}${getRouter().buildLocation({ to: "/e/$uuid", params: { uuid: event.id } }).href}`;
	const shiftDate = formatShiftDate(shift);

	const html = buildReceiptHtml({
		firstName: signup.firstName,
		eventTitle: event.title,
		eventDescription: event.description,
		eventLocation: event.location,
		shiftLabel: shift.label,
		shiftDate,
		eventUrl,
	});

	// Build a MIME multipart/mixed email manually so we can attach the .ics file.
	const boundary = `vcm-boundary-${crypto.randomUUID().replace(/-/g, "")}`;
	const from = fromEmail();
	const to = signup.email;
	const subject = `Anmeldebestätigung: ${event.title}`;

	const rawMessage = [
		`From: ${from}`,
		`To: ${to}`,
		`Subject: ${subject}`,
		"MIME-Version: 1.0",
		`Content-Type: multipart/mixed; boundary="${boundary}"`,
		"",
		`--${boundary}`,
		'Content-Type: text/html; charset="UTF-8"',
		"Content-Transfer-Encoding: quoted-printable",
		"",
		html,
		"",
		`--${boundary}`,
		'Content-Type: text/calendar; charset="UTF-8"; method=REQUEST',
		"Content-Transfer-Encoding: base64",
		`Content-Disposition: attachment; filename="termin.ics"`,
		"",
		Buffer.from(icsContent).toString("base64"),
		"",
		`--${boundary}--`,
	].join("\r\n");

	const ses = getSesClient();
	await ses.send(
		new SendRawEmailCommand({
			RawMessage: { Data: Buffer.from(rawMessage) },
		}),
	);
}
