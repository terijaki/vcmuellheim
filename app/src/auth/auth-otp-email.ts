/**
 * OTP email templates for the better-auth email-OTP login flow.
 *
 * Both HTML and text bodies include the WICG one-time-code origin binding line
 * (`@<domain> #<otp>`) so that Apple Safari / iOS Passwords and other
 * autofill-capable clients can automatically suggest the code to the user.
 *
 * Spec: https://wicg.github.io/sms-one-time-codes/#conforming-email
 */

export interface OtpEmailOptions {
  otp: string;
  otpLoginLink: string;
  clubShortName: string;
  domain: string;
  expirationMinutes: number;
}

export function buildOtpEmailSubject(clubShortName: string): string {
  return `Dein Anmeldecode für das ${clubShortName} CMS`;
}

export function buildOtpEmailHtml(options: OtpEmailOptions): string {
  const { otp, otpLoginLink, clubShortName, domain, expirationMinutes } = options;

  return `<p>Hallo,</p>
<p>dein Anmeldecode für das ${clubShortName} CMS lautet:</p>
<h2 style="letter-spacing: 4px; font-size: 32px;">${otp}</h2>
<p>Du kannst dich entweder:</p>
<p>
\t<a href="${otpLoginLink}" target="_blank" rel="noopener noreferrer">
\t\tPer Link im CMS anmelden
\t</a>
</p>
<p>Oder gib den Code manuell auf der Login-Seite ein.</p>
<p>Dieser Code ist <strong>${expirationMinutes} Minuten</strong> gültig.</p>
<p>Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.</p>
<p>Sportliche Grüße,<br>${clubShortName}</p>
<!-- @${domain} #${otp} -->`;
}

export function buildOtpEmailText(options: OtpEmailOptions): string {
  const { otp, otpLoginLink, clubShortName, domain, expirationMinutes } = options;

  return `Dein Anmeldecode für das ${clubShortName} CMS: ${otp}

Per Link im CMS anmelden: ${otpLoginLink}

Wenn der Link nicht funktioniert, gib den Code manuell auf der Login-Seite ein.

Dieser Code ist ${expirationMinutes} Minuten gültig.

@${domain} #${otp}`;
}
