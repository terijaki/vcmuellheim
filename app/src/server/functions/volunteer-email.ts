/**
 * Email helpers for the Volunteer Event Planner feature.
 *
 * - Confirmation email: sent on signup, contains a verification link (72 h TTL).
 * - Receipt email: sent after token verification, includes a .ics calendar attachment.
 *
 * Both emails are written in German and use AWS SES v2.
 */

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { interpolatePath } from "@tanstack/react-router";
import type { FileRoutesByPath } from "@tanstack/react-router";
import { Club, Mail } from "@project.config";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { generateIcsCalendar, type IcsEvent } from "ts-ics";
import type { VolunteerEvent, VolunteerSignup } from "@/lib/db/types";
import { escapeHtml } from "@/utils/html";
import { getAppBaseUrl } from "./app-base-url";
import { slugify } from "@/utils/slugify";

dayjs.extend(utc);
dayjs.extend(timezone);

const isProd = process.env.CDK_ENVIRONMENT === "prod";

function getSesClient(): SESv2Client {
  return new SESv2Client({ region: process.env.AWS_REGION ?? "eu-central-1" });
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

  const icsEvent: IcsEvent = {
    uid: `volunteer-signup-${shiftId}@${Club.domain}`,
    summary: `${shift.label} - ${event.title}`,
    start: { date: start.toDate(), type: "DATE-TIME" },
    end: { date: end.toDate(), type: "DATE-TIME" },
    stamp: { date: new Date(), type: "DATE-TIME" },
    description: `${event.title}\nVeranstaltungsseite: ${appBaseUrl()}${routePath("/e/$uuid", { uuid: event.id })}`,
    location: event.location ?? "",
  };

  const calendar = generateIcsCalendar({
    version: "2.0",
    prodId: `-//${Club.name}//DE`,
    method: "PUBLISH",
    events: [icsEvent],
  });
  return calendar;
}

// ---------------------------------------------------------------------------
// HTML templates
// ---------------------------------------------------------------------------

function buildConfirmationHtml(opts: {
  firstName: string;
  shiftLabel: string;
  shiftDate: string;
  eventTitle: string;
  confirmationUrl: string;
  organizerName: string;
  organizerEmail: string;
}): string {
  const {
    firstName,
    shiftLabel,
    shiftDate,
    eventTitle,
    confirmationUrl,
    organizerName,
    organizerEmail,
  } = opts;
  return `<p>Hallo ${firstName},</p>
<p>danke für deine Anmeldung zur Veranstaltung <strong>${eventTitle}</strong>!</p>
<p>Du hast dich für den Einsatz <strong>${shiftLabel}</strong> am <strong>${shiftDate}</strong> angemeldet.</p>
<p>Bitte bestätige deine Anmeldung innerhalb von <em>72 Stunden</em> über den folgenden Link:</p>
<p><a href="${confirmationUrl}" target="_blank" rel="noopener noreferrer">${confirmationUrl}</a><br></p>
<p>Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.</p>
<p>Sportliche Grüße,<br>${Club.shortName}<br><a href="mailto:${organizerEmail}">${organizerName}</a></p>`;
}

function buildReceiptHtml(opts: {
  firstName: string;
  eventLocation: string | undefined;
  eventLocationUrl: string | undefined;
  shiftLabel: string;
  shiftDate: string;
  eventUrl: string;
  organizerName: string;
  organizerEmail: string;
}): string {
  const {
    firstName,
    eventLocation,
    eventLocationUrl,
    shiftLabel,
    shiftDate,
    eventUrl,
    organizerName,
    organizerEmail,
  } = opts;

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
<p>Sportliche Grüße,<br>${Club.shortName}<br><a href="mailto:${organizerEmail}">${organizerName}</a></p>`;
}

function buildOrganizerNotificationHtml(opts: {
  volunteerName: string;
  volunteerEmail: string;
  eventTitle: string;
  shiftLabel: string;
  shiftDate: string;
  roleLabel: string;
  organizerName: string;
}): string {
  const { volunteerName, volunteerEmail, eventTitle, shiftLabel, shiftDate, roleLabel } = opts;
  const safeVolunteerName = escapeHtml(volunteerName);
  const safeVolunteerEmail = escapeHtml(volunteerEmail);
  const safeEventTitle = escapeHtml(eventTitle);
  const safeShiftLabel = escapeHtml(shiftLabel);
  const safeShiftDate = escapeHtml(shiftDate);
  const safeRoleLabel = escapeHtml(roleLabel);
  const safeOrganizerName = escapeHtml(opts.organizerName);

  return `<p>Hallo ${safeOrganizerName},</p>
<p>es gab eine neue Anmeldung für die Veranstaltung <strong>${safeEventTitle}</strong>.</p>
<hr/>
<p><strong>Person:</strong> ${safeVolunteerName}</p>
<p><strong>E-Mail:</strong> ${safeVolunteerEmail}</p>
<p><strong>Aufgabe:</strong> ${safeRoleLabel}</p>
<p><strong>Schicht:</strong> ${safeShiftLabel}</p>
<p><strong>Datum / Uhrzeit:</strong> ${safeShiftDate}</p>
`;
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
export async function sendVolunteerConfirmationEmail(opts: {
  toEmail: string;
  firstName: string;
  event: VolunteerEvent;
  shiftId: string;
  tokenId: string;
}): Promise<void> {
  const { toEmail, firstName, event, shiftId, tokenId } = opts;

  const shift = event.shifts.find((s) => s.id === shiftId);
  if (!shift) throw new Error(`Shift ${shiftId} not found on event ${event.id}`);

  const confirmationUrl = `${appBaseUrl()}${routePath("/e/$uuid", { uuid: event.id })}?token=${encodeURIComponent(tokenId)}`;
  const shiftDate = formatShiftDate(shift);
  const organizerEmail = event.organizerEmail;

  const html = buildConfirmationHtml({
    firstName,
    shiftLabel: shift.label,
    shiftDate,
    eventTitle: event.title,
    confirmationUrl,
    organizerName: event.organizerName,
    organizerEmail,
  });

  const ses = getSesClient();
  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: fromEmail(),
      ReplyToAddresses: [organizerEmail],
      Destination: { ToAddresses: [toEmail] },
      Content: {
        Simple: {
          Subject: { Data: `Anmeldung bestätigen: ${event.title}`, Charset: "UTF-8" },
          Body: {
            Html: { Data: html, Charset: "UTF-8" },
            Text: {
              Data: `Hallo ${firstName},\n\nBitte bestätige deine Anmeldung: ${confirmationUrl}\n\nDieser Link ist 72 Stunden gültig.\n\nBei Fragen wende dich an: ${organizerEmail}\n\n${Club.shortName}`,
              Charset: "UTF-8",
            },
          },
        },
      },
    }),
  );
}

/** Send the receipt email with a .ics calendar attachment. */
export async function sendVolunteerReceiptEmail(opts: {
  signup: VolunteerSignup;
  event: VolunteerEvent;
}): Promise<void> {
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
    organizerName: event.organizerName,
    organizerEmail: event.organizerEmail,
  });

  // Build a MIME multipart/mixed email manually so we can attach the .ics file.
  const boundary = `vcm-boundary-${crypto.randomUUID().replace(/-/g, "")}`;
  const from = fromEmail();
  const to = signup.email;
  const subject = event.title;

  const rawMessage = [
    `From: ${from}`,
    `To: ${to}`,
    `Reply-To: ${event.organizerEmail}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(html).toString("base64"),
    "",
    `--${boundary}`,
    'Content-Type: text/calendar; charset="UTF-8"; method=PUBLISH',
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${slugify(`${event.title} ${shift.label}`, true)}.ics"`,
    "",
    Buffer.from(icsContent).toString("base64"),
    "",
    `--${boundary}--`,
  ].join("\r\n");

  const ses = getSesClient();
  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: from,
      Destination: {
        ToAddresses: [to],
      },
      Content: {
        Raw: {
          Data: Buffer.from(rawMessage),
        },
      },
    }),
  );
}

/** Send organizer notification after a volunteer signup was confirmed via token verification. */
export async function sendVolunteerOrganizerNotificationEmail(opts: {
  signup: VolunteerSignup;
  event: VolunteerEvent;
}): Promise<void> {
  const { signup, event } = opts;

  const shift = event.shifts.find((s) => s.id === signup.shiftId);
  if (!shift) throw new Error(`Shift ${signup.shiftId} not found on event ${event.id}`);

  const assignedRoleLabel = shift.roles.find((role) => role.id === signup.assignedRoleId)?.label;
  const roleLabel = assignedRoleLabel ?? "Noch nicht zugewiesen";
  const volunteerName = `${signup.firstName} ${signup.lastName}`;
  const shiftDate = formatShiftDate(shift);

  const html = buildOrganizerNotificationHtml({
    volunteerName,
    volunteerEmail: signup.email,
    eventTitle: event.title,
    shiftLabel: shift.label,
    shiftDate,
    roleLabel,
    organizerName: event.organizerName,
  });

  const ses = getSesClient();
  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: fromEmail(),
      ReplyToAddresses: [signup.email],
      Destination: { ToAddresses: [event.organizerEmail] },
      Content: {
        Simple: {
          Subject: {
            Data: `${event.title} & ${volunteerName}`,
            Charset: "UTF-8",
          },
          Body: {
            Html: { Data: html, Charset: "UTF-8" },
            Text: {
              Data: `${volunteerName} hat die Anmeldung für ${event.title} bestätigt.\n\nE-Mail: ${signup.email}\nVeranstaltung: ${event.title}\nSchicht: ${shift.label}\nDatum / Uhrzeit: ${shiftDate}\nAufgabe: ${roleLabel}`,
              Charset: "UTF-8",
            },
          },
        },
      },
    }),
  );
}

/** Send a single bulk email from organizer to one recipient. */
export async function sendBulkVolunteerEmail(opts: {
  toEmail: string;
  subject: string;
  htmlBody: string;
  organizerEmail: string;
}): Promise<void> {
  const { toEmail, subject, htmlBody, organizerEmail } = opts;
  const ses = getSesClient();
  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: fromEmail(),
      ReplyToAddresses: [organizerEmail],
      Destination: { ToAddresses: [toEmail] },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: htmlBody, Charset: "UTF-8" },
          },
        },
      },
    }),
  );
}
