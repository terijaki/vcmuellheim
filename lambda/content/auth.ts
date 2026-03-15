/**
 * better-auth server instance for CMS authentication
 * - Passwordless email OTP login
 * - Stateless JWE session cookies with relaxed caching (30-day cookie cache, 90-day session lifetime)
 * - Email whitelist enforced via a before hook (only emails registered in DynamoDB USERS table can request OTP)
 * - Wildcard trusted origins for *.vcmuellheim.de (supported in better-auth ≥ 1.5)
 */

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";
import { dynamoDBAdapter } from "@/lambda/utils/better-auth-dynamodb-adapter";
import { getCmsUserByEmail } from "@/lib/db/repositories";
import { Club } from "@/project.config";

const sesClient = new SESClient({
	region: process.env.AWS_REGION || "eu-central-1",
});

export const auth = betterAuth({
	// baseURL is intentionally omitted — better-auth infers it from the incoming request
	secret: process.env.BETTER_AUTH_SECRET || "",
	trustedOrigins: ["https://vcmuellheim.de", "https://*.vcmuellheim.de"],
	database: dynamoDBAdapter,
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
	user: {
		additionalFields: {
			role: {
				type: "string",
				required: true,
				defaultValue: "Moderator",
			},
		},
	},
	hooks: {
		// Before processing any request, check that the email requesting an OTP is whitelisted
		before: createAuthMiddleware(async (ctx) => {
			if (ctx.path === "/email-otp/send-verification-otp") {
				const email = ctx.body?.email as string | undefined;
				if (email) {
					const user = await getCmsUserByEmail(email);
					if (!user) {
						throw new APIError("FORBIDDEN", {
							message: "Diese E-Mail-Adresse ist nicht berechtigt.",
						});
					}
				}
			}
		}),
	},
	plugins: [
		emailOTP({
			// Prevent automatic user sign-up — only pre-registered users can login
			disableSignUp: true,
			// OTP expires after 10 minutes
			expiresIn: 10 * 60,
			// Send OTP via AWS SES (whitelist check is handled by hooks.before above)
			async sendVerificationOTP({ email, otp }) {
				await sesClient.send(
					new SendEmailCommand({
						Source: `${Club.shortName} <no-reply@vcmuellheim.de>`,
						Destination: { ToAddresses: [email] },
						Message: {
							Subject: {
								Data: `Dein Anmeldecode für das ${Club.shortName} CMS`,
								Charset: "UTF-8",
							},
							Body: {
								Html: {
									Data: `
<p>Hallo 👋,</p>
<p>dein Anmeldecode für das ${Club.shortName} CMS lautet:</p>
<h2 style="letter-spacing: 4px; font-size: 32px;">${otp}</h2>
<p>Dieser Code ist <strong>10 Minuten</strong> gültig.</p>
<p>Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.</p>
<p>Sportliche Grüße,<br>${Club.shortName}</p>
`,
									Charset: "UTF-8",
								},
								Text: {
									Data: `Dein Anmeldecode: ${otp}\n\nDieser Code ist 10 Minuten gültig.`,
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
