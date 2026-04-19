/**
 * Email helpers for the Volunteer Event Planner feature.
 *
 * - Confirmation email: sent on signup, contains a verification link (72 h TTL).
 * - Receipt email: sent after token verification, includes a .ics calendar attachment.
 *
 * Both emails are written in German and use AWS SES via the @aws-sdk/client-ses package.
 */

import { SendEmailCommand, SendRawEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { interpolatePath } from "@tanstack/react-router";
import type { FileRoutesByPath } from "@tanstack/react-router";
import { Club, Mail } from "@project.config";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { generateIcsCalendar, type IcsEvent } from "ts-ics";
import type { VolunteerEvent, VolunteerSignup } from "@/lib/db/types";
import { getAppBaseUrl } from "./app-base-url";
import { slugify } from "@/utils/slugify";

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
	return getAppBaseUrl();
}

/** Union of every route's real URL path (without layout-group prefixes). */
type RoutePaths = FileRoutesByPath[keyof FileRoutesByPath]["fullPath"];

/** Build a type-safe route path — TypeScript errors if the path is invalid. */
function routePath(path: RoutePaths, params: Record<string, string>): string {
	return interpolatePath({ path, params }).interpolatedPath;
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
		description: `${event.title}\nVeranstaltungsseite: ${appBaseUrl()}${routePath("/e/$uuid", { uuid: event.id })}`,
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
<p>danke für deine Anmeldung zur Veranstaltung <strong>${eventTitle}</strong>!</p>
<p>Du hast dich für den Einsatz <strong>${shiftLabel}</strong> am <strong>${shiftDate}</strong> angemeldet.</p>
<p>Bitte bestätige deine Anmeldung innerhalb von <em>72 Stunden</em> über den folgenden Link:</p>
<p><a href="${confirmationUrl}" target="_blank" rel="noopener noreferrer">${confirmationUrl}</a><br></p>
<p>Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.</p>
<p>Sportliche Grüße,<br>${Club.shortName}</p>`;
}

function buildReceiptHtml(opts: { firstName: string; eventLocation: string | undefined; eventLocationUrl: string | undefined; shiftLabel: string; shiftDate: string; eventUrl: string }): string {
	const { firstName, eventLocation, eventLocationUrl, shiftLabel, shiftDate, eventUrl } = opts;

	let locationLine = "";
	if (eventLocation && !eventLocationUrl) {
		locationLine = `<p><strong>Ort:</strong> ${eventLocation}</p>`;
	}
	if (eventLocationUrl && !eventLocation) {
		locationLine = `<p><strong>Ort:</strong> <a href="${eventLocationUrl}" target="_blank" rel="noopener noreferrer">${eventLocationUrl}</a></p>`;
	}
	if (eventLocation && eventLocationUrl) {
		locationLine = `<p><strong>Ort:</strong> <a href="${eventLocationUrl}" target="_blank" rel="noopener noreferrer">${eventLocation}</a></p>`;
	}

	return `<p>Hallo ${firstName},</p>
<p>deine Anmeldung wurde bestätigt. Vielen Dank! 🙏</p>
<p>Hier nochmal die Infos für dich. Im Anhang findest du den Termin als <em>Kalender-Datei</em>.</p>
<hr/>
<p><strong>Datum / Uhrzeit:</strong> ${shiftDate}</p>
${locationLine}
<p><strong>Einsatz:</strong> ${shiftLabel}</p>
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

	const confirmationUrl = `${appBaseUrl()}${routePath("/e/$uuid", { uuid: event.id })}?token=${encodeURIComponent(tokenId)}`;
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
	const eventUrl = `${appBaseUrl()}${routePath("/e/$uuid", { uuid: event.id })}`;
	const shiftDate = formatShiftDate(shift);

	const html = buildReceiptHtml({
		firstName: signup.firstName,
		eventLocation: event.location,
		eventLocationUrl: event.locationUrl,
		shiftLabel: shift.label,
		shiftDate,
		eventUrl,
	});

	// Build a MIME multipart/mixed email manually so we can attach the .ics file.
	const boundary = `vcm-boundary-${crypto.randomUUID().replace(/-/g, "")}`;
	const from = fromEmail();
	const to = signup.email;
	const subject = event.title;

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
		`Content-Disposition: attachment; filename="${slugify(`${event.title} ${shift.label}`, true)}.ics"`,
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
