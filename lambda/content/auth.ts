/**
 * better-auth server instance for CMS authentication
 * - Passwordless email OTP login
 * - Stateless JWE session cookies with relaxed caching (30-day cookie cache, 90-day session lifetime)
 * - OTP email includes both manual code entry and a direct sign-in link
 * - Wildcard trusted origins for *.vcmuellheim.de (supported in better-auth ≥ 1.5)
 */

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { dynamoDBAdapter } from "@/lambda/utils/better-auth-dynamodb-adapter";
import { Club } from "@/project.config";
import { parseLambdaEnv } from "../utils/env";
import { ContentAuthEnvironmentSchema } from "./types";

const env = parseLambdaEnv(ContentAuthEnvironmentSchema);

const sesClient = new SESClient({
	region: env.AWS_REGION,
});

function parseOrigin(value: string | null | undefined): URL | null {
	if (!value) {
		return null;
	}

	try {
		return new URL(value);
	} catch {
		return null;
	}
}

function isTrustedCmsHost(hostname: string): boolean {
	return hostname === "localhost" || hostname === "127.0.0.1" || hostname === Club.domain || hostname.endsWith(`.${Club.domain}`);
}

function toAdminHostname(hostname: string): string {
	if (hostname.includes("-api.")) {
		return hostname.replace("-api.", "-admin.");
	}

	if (hostname.startsWith("api.")) {
		return hostname.replace("api.", "admin.");
	}

	return hostname;
}

function toOriginString(url: URL): string {
	const hostname = toAdminHostname(url.hostname);
	const port = url.port ? `:${url.port}` : "";
	return `${url.protocol}//${hostname}${port}`;
}

function resolveCmsOrigin(request?: Request): string {
	const originCandidate = parseOrigin(request?.headers.get("origin"));
	if (originCandidate && isTrustedCmsHost(originCandidate.hostname)) {
		return toOriginString(originCandidate);
	}

	const refererCandidate = parseOrigin(request?.headers.get("referer"));
	if (refererCandidate && isTrustedCmsHost(refererCandidate.hostname)) {
		return toOriginString(refererCandidate);
	}

	const requestCandidate = parseOrigin(request?.url);
	if (requestCandidate && isTrustedCmsHost(requestCandidate.hostname)) {
		return toOriginString(requestCandidate);
	}

	return `https://admin.${Club.domain}`;
}

function createOtpLoginLink(email: string, otp: string, request?: Request): string {
	const loginUrl = new URL("/otp-login", resolveCmsOrigin(request));
	loginUrl.searchParams.set("email", email);
	loginUrl.searchParams.set("otp", otp);
	return loginUrl.toString();
}

export const auth = betterAuth({
	baseURL: {
		allowedHosts: [Club.domain, `*.${Club.domain}`, `*.new.${Club.domain}`, "localhost:*"],
		protocol: "https",
	},
	secret: env.BETTER_AUTH_SECRET,
	trustedOrigins: ["https://vcmuellheim.de", "https://*.vcmuellheim.de", "https://*.new.vcmuellheim.de"], // TODO might not be needed due to dynamic baseUrl
	database: dynamoDBAdapter,
	advanced: {
		// Lambda does not set NODE_ENV=production by default, so better-auth would
		// otherwise emit non-secure cookies. Force Secure without changing the
		// cookie names (useSecureCookies would add __Secure- prefix).
		defaultCookieAttributes: {
			secure: true,
		},
		// Scope cookies to the shared parent domain so both the API
		// (*.new.vcmuellheim.de) and admin app subdomains share the same cookie.
		// Without a Domain attribute the cookie is host-only to the API domain,
		// causing browsers (especially Safari ITP) to drop cross-origin Set-Cookie.
		crossSubDomainCookies: {
			enabled: true,
			domain: "vcmuellheim.de",
		},
	},
	session: {
		cookieCache: {
			enabled: true,
			// Re-validates session after 30 days (cookieCache.maxAge)
			// Session itself expires after 90 days (session.expiresIn below)
			maxAge: 30 * 24 * 60 * 60,
			strategy: "jwe",
		},
		// Sessions valid for 90 days so users stay logged in longer
		expiresIn: 90 * 24 * 60 * 60,
	},
	account: {
		storeStateStrategy: "cookie",
	},
	user: {
		additionalFields: {
			role: {
				type: "string",
				required: true,
				defaultValue: "Moderator",
			},
		},
	},
	plugins: [
		emailOTP({
			// Prevent automatic user sign-up — only pre-registered users can login
			disableSignUp: true,
			// OTP expires after 10 minutes
			expiresIn: 10 * 60,
			// Send OTP via AWS SES with both code and direct sign-in link
			async sendVerificationOTP({ email, otp }, ctx) {
				const otpLoginLink = createOtpLoginLink(email, otp, ctx?.request);

				await sesClient.send(
					new SendEmailCommand({
						Source: "no-reply@vcmuellheim.de",
						Destination: { ToAddresses: [email] },
						Message: {
							Subject: {
								Data: `Dein Anmeldecode für das ${Club.shortName} CMS`,
								Charset: "UTF-8",
							},
							Body: {
								Html: {
									Data: `
<p>Hallo,</p>
<p>dein Anmeldecode für das ${Club.shortName} CMS lautet:</p>
<h2 style="letter-spacing: 4px; font-size: 32px;">${otp}</h2>
<p style="margin: 8px 0 20px; color: #4b5563;">${otp} ist dein Sicherheitscode für das ${Club.shortName} CMS.</p>
<p>Du kannst dich entweder direkt anmelden:</p>
<p style="margin: 16px 0 20px;">
	<a href="${otpLoginLink}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 10px 16px; border-radius: 6px; background: #366273; color: #ffffff; text-decoration: none; font-weight: 600;">
		Direkt im CMS anmelden
	</a>
</p>
<p>Oder gib den Code manuell auf der Login-Seite ein.</p>
<p>Dieser Code ist <strong>10 Minuten</strong> gültig.</p>
<p>Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.</p>
<p>Sportliche Grüße,<br>${Club.shortName}</p>
`,
									Charset: "UTF-8",
								},
								Text: {
									Data: `Dein Anmeldecode für das ${Club.shortName} CMS: ${otp}\n\nDirekt im CMS anmelden: ${otpLoginLink}\n\nWenn der Link nicht funktioniert, gib den Code manuell auf der Login-Seite ein.\n\nDieser Code ist 10 Minuten gültig.`,
									Charset: "UTF-8",
								},
							},
						},
					}),
				);
			},
		}),
	],
});

export type Auth = typeof auth;
