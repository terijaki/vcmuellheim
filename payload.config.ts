import { postgresAdapter } from "@payloadcms/db-postgres";
import { resendAdapter } from "@payloadcms/email-resend";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { s3Storage } from "@payloadcms/storage-s3";
import { de } from "@payloadcms/translations/languages/de";
import { en } from "@payloadcms/translations/languages/en";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConfig } from "payload";
import sharp from "sharp";
import { Events } from "./collections/Events";
import { Locations } from "./collections/Locations";
import { Media } from "./collections/Media";
import { Members } from "./collections/Members";
import { News } from "./collections/News";
import { Roles } from "./collections/Roles";
import { SamsTeams } from "./collections/SamsTeams";
import { Sponsors } from "./collections/Sponsors";
import { Teams } from "./collections/Teams";
import { Users } from "./collections/Users";
import { Club } from "./project.config";
// import { migrations } from './data/migrations' //TODO enable after first migration

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

// Create required directories if they don't exist
mkdirSync(path.join(dirname, "data/migrations"), { recursive: true });

// #region Email Configuration
// (if env api key is set)
const emailConfig = process.env.RESEND_API_KEY
	? resendAdapter({
			defaultFromAddress: "noreply@payload.vcmuellheim.de",
			defaultFromName: `${Club.name} CMS`,
			apiKey: process.env.RESEND_API_KEY,
		})
	: undefined;
// #endregion
// #region AutoLogin Configuration
// (if env credentials are set)
const autoLoginConfig =
	process.env.PAYLOAD_DEV_EMAIL && process.env.PAYLOAD_DEV_PASSWORD
		? { prefillOnly: true, email: process.env.PAYLOAD_DEV_EMAIL, password: process.env.PAYLOAD_DEV_PASSWORD }
		: undefined;
// #endregion

export default buildConfig({
	secret: process.env.PAYLOAD_SECRET || "",
	admin: {
		user: Users.slug,
		importMap: { baseDir: path.resolve(dirname) },
		timezones: { defaultTimezone: "Europe/Berlin" },
		autoLogin: autoLoginConfig,
	},
	collections: [Users, Media, Events, News, Roles, Members, Teams, Locations, Sponsors, SamsTeams],
	editor: lexicalEditor(),
	typescript: {
		outputFile: path.resolve(dirname, "data/payload-types.ts"),
	},
	db: postgresAdapter({
		pool: { connectionString: process.env.DATABASE_URL || "" },
		migrationDir: path.resolve(dirname, "data/migrations"),
		idType: "uuid",
		// prodMigrations: migrations //TODO enable after first migration
	}),
	sharp,
	upload: {
		limits: {
			fileSize: 5000000, // 5MB, written in bytes
		},
	},
	debug: process.env.NODE_ENV !== "production",
	plugins: [
		s3Storage({
			collections: {
				media: true,
			},
			bucket: process.env.S3_BUCKET || "",
			config: {
				credentials: {
					accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
					secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
				},
				region: process.env.S3_REGION,
			},
		}),
	],
	email: emailConfig,
	i18n: {
		supportedLanguages: { de, en },
		fallbackLanguage: "de",
	},
	cookiePrefix: "vcmuellheim-cms",
});
