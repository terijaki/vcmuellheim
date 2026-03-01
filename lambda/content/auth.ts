/**
 * better-auth server instance for CMS authentication
 * - Passwordless email OTP login
 * - Stateless JWE session cookies with relaxed caching (30-day cookie cache, 90-day session lifetime)
 * - User whitelist enforced via DynamoDB
 *
 * BETTER_AUTH_SECRET is provided via CloudFormation dynamic reference ({{resolve:secretsmanager:...}})
 * which resolves at deploy time — the secret is NOT stored as plaintext in the CloudFormation template.
 */

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { dynamoDBAdapter } from "@/lambda/utils/better-auth-dynamodb-adapter";
import { getCmsUserByEmail } from "@/lib/db/repositories";
import { Club } from "@/project.config";

const sesClient = new SESClient({
	region: process.env.AWS_REGION || "eu-central-1",
});

export const auth = betterAuth({
	baseURL: process.env.BETTER_AUTH_URL || "",
	secret: process.env.BETTER_AUTH_SECRET || "",
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
	plugins: [
		emailOTP({
			// Prevent automatic user sign-up — only pre-registered users can login
			disableSignUp: true,
			// OTP expires after 10 minutes
			expiresIn: 10 * 60,
			// Send OTP via AWS SES
			async sendVerificationOTP({ email, otp }) {
				// Check if the user is whitelisted before sending
				const user = await getCmsUserByEmail(email);
				if (!user) {
					// Silently ignore — better-auth will handle the error
					return;
				}

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
