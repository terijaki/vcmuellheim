/**
 * better-auth server instance for the webapp
 * Reuses the same configuration as the Lambda auth handler, adapted for TanStack Start.
 * - Passwordless email OTP login
 * - Stateless JWE session cookies shared across vcmuellheim.de subdomains
 * - OTP login link points to /admin
 */

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { Club, Mail } from "@project.config";
import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { buildOtpEmailHtml, buildOtpEmailSubject, buildOtpEmailText } from "./auth-otp-email";
import { memberAuthAdapter } from "./auth-member-adapter";
import { dynamoDBSecondaryStorage } from "./auth-secondary-storage";
import { getMemberByProxyEmail } from "../server/queries";

const OTP_EXPIRATION_MINUTES = 10;

const isProd = process.env.CDK_ENVIRONMENT === "prod";

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
	const loginUrl = new URL("/admin/otp-login", resolveAppOrigin(request));
	loginUrl.searchParams.set("email", email);
	loginUrl.searchParams.set("otp", otp);
	return loginUrl.toString();
}

function getTrusedOrigins({ isLocalDev = false } = {}): string[] {
	const origins = [`https://${Club.domain}`];

	if (!isProd) {
		origins.push(`https://*.new.${Club.domain}`);
	}
	if (isLocalDev) {
		origins.push("http://localhost:*", "http://127.0.0.1:*");
	}

	return origins;
}

function createAuth() {
	const secret = process.env.BETTER_AUTH_SECRET;
	if (!secret) {
		throw new Error("BETTER_AUTH_SECRET environment variable is required");
	}
	const isLocalDev = process.env.NODE_ENV === "development";

	return betterAuth({
		baseURL: {
			allowedHosts: [Club.domain, `*.${Club.domain}`, `*.new.${Club.domain}`, "localhost:*", "*.lambda-url.eu-central-1.on.aws"],
			protocol: isLocalDev ? "http" : "https",
		},
		secret,
		trustedOrigins: getTrusedOrigins({ isLocalDev }),
		database: memberAuthAdapter,
		secondaryStorage: dynamoDBSecondaryStorage,
		advanced: {
			defaultCookieAttributes: {
				secure: !isLocalDev,
			},
			crossSubDomainCookies: isLocalDev ? { enabled: false } : { enabled: !isProd, domain: `new.${Club.domain}` },
		},
		session: {
			storeSessionInDatabase: false,
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
				authRole: {
					type: "string",
					required: true,
				},
			},
		},
		plugins: [
			emailOTP({
				disableSignUp: true,
				expiresIn: OTP_EXPIRATION_MINUTES * 60,
				async sendVerificationOTP({ email, otp }, ctx) {
					// When the login input is a proxy alias, resolve it to the member's
					// privateEmail so the OTP is always delivered to the canonical address.
					let targetEmail = email;
					const proxyMember = await getMemberByProxyEmail(email);
					if (proxyMember?.privateEmail) {
						targetEmail = proxyMember.privateEmail;
					}

					const otpLoginLink = createOtpLoginLink(email, otp, ctx?.request);
					const sesClient = getSesClient();

					const emailOpts = {
						otp,
						otpLoginLink,
						clubShortName: Club.shortName,
						domain: Club.domain,
						expirationMinutes: OTP_EXPIRATION_MINUTES,
					};

					await sesClient.send(
						new SendEmailCommand({
							Source: isProd ? Mail.prod.systemFromEmail : Mail.dev.systemFromEmail,
							Destination: { ToAddresses: [targetEmail] },
							Message: {
								Subject: {
									Data: buildOtpEmailSubject(Club.shortName),
									Charset: "UTF-8",
								},
								Body: {
									Html: {
										Data: buildOtpEmailHtml(emailOpts),
										Charset: "UTF-8",
									},
									Text: {
										Data: buildOtpEmailText(emailOpts),
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
