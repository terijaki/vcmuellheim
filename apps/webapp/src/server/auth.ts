/**
 * better-auth server instance for the webapp
 * Reuses the same configuration as the Lambda auth handler, adapted for TanStack Start.
 * - Passwordless email OTP login
 * - Stateless JWE session cookies shared across vcmuellheim.de subdomains
 * - OTP login link points to /admin
 */

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { Club } from "@project.config";
import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { dynamoDBAdapter } from "@/lambda/utils/better-auth-dynamodb-adapter";

function getSesClient() {
	return new SESClient({
		region: process.env.AWS_REGION || "eu-central-1",
	});
}

function parseOrigin(value: string | null | undefined): URL | null {
	if (!value) return null;
	try {
		return new URL(value);
	} catch {
		return null;
	}
}

function isTrustedHost(hostname: string): boolean {
	return hostname === "localhost" || hostname === "127.0.0.1" || hostname === Club.domain || hostname.endsWith(`.${Club.domain}`);
}

function toOriginString(url: URL): string {
	const port = url.port ? `:${url.port}` : "";
	return `${url.protocol}//${url.hostname}${port}`;
}

function resolveAppOrigin(request?: Request): string {
	const originCandidate = parseOrigin(request?.headers.get("origin"));
	if (originCandidate && isTrustedHost(originCandidate.hostname)) {
		return toOriginString(originCandidate);
	}

	const refererCandidate = parseOrigin(request?.headers.get("referer"));
	if (refererCandidate && isTrustedHost(refererCandidate.hostname)) {
		return toOriginString(refererCandidate);
	}

	return `https://${Club.domain}`;
}

function createOtpLoginLink(email: string, otp: string, request?: Request): string {
	const loginUrl = new URL("/admin", resolveAppOrigin(request));
	loginUrl.searchParams.set("email", email);
	loginUrl.searchParams.set("otp", otp);
	return loginUrl.toString();
}

function createAuth() {
	const secret = process.env.BETTER_AUTH_SECRET;
	if (!secret) {
		throw new Error("BETTER_AUTH_SECRET environment variable is required");
	}

	return betterAuth({
		baseURL: {
			allowedHosts: [Club.domain, `*.${Club.domain}`, `*.new.${Club.domain}`, "localhost:*"],
			protocol: "https",
		},
		secret,
		trustedOrigins: [`https://${Club.domain}`, `https://*.${Club.domain}`, `https://*.new.${Club.domain}`],
		database: dynamoDBAdapter,
		advanced: {
			// Force Secure cookies — the server doesn't set NODE_ENV=production, so
			// better-auth would otherwise emit non-secure cookies even on HTTPS.
			defaultCookieAttributes: {
				secure: true,
			},
			// Scope cookies to the parent domain so auth state is shared across
			// the single-domain app and any subdomains.
			crossSubDomainCookies: {
				enabled: true,
				domain: "vcmuellheim.de",
			},
		},
		session: {
			cookieCache: {
				enabled: true,
				maxAge: 30 * 24 * 60 * 60,
				strategy: "jwe",
			},
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
				disableSignUp: true,
				expiresIn: 10 * 60,
				async sendVerificationOTP({ email, otp }, ctx) {
					const otpLoginLink = createOtpLoginLink(email, otp, ctx?.request);
					const sesClient = getSesClient();

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
}

// Lazily created to avoid crashing at build time when env vars aren't present
let _auth: ReturnType<typeof createAuth> | null = null;

export function getAuth(): ReturnType<typeof createAuth> {
	if (_auth) return _auth;

	_auth = createAuth();

	return _auth;
}
