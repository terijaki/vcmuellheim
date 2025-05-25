import { isModerator, isOfficial } from "@/data/payload-access";
import type { CollectionConfig } from "payload";

export const Media: CollectionConfig = {
	slug: "media",
	labels: { plural: "Dateien", singular: "Datei" },
	admin: {
		group: "System",
		defaultColumns: ["filename", "size", "createdAt"],
	},
	access: {
		read: () => true,
		create: isOfficial,
		update: isModerator,
		delete: isModerator,
	},
	fields: [
		{
			name: "alt",
			type: "text",
			required: false,
			admin: { description: "Alternativtext (für Screenreader, etc.)" },
		},
		{
			type: "join",
			name: "news",
			collection: "news",
			on: "images",
			admin: {
				allowCreate: false,
				condition: (data, siblingData) => Boolean(siblingData?.news?.docs?.length > 0),
				defaultColumns: ["title", "publishedDate", "author"],
			},
		},
		{
			type: "join",
			name: "members",
			collection: "members",
			on: "avatar",
			admin: {
				allowCreate: false,
				condition: (data, siblingData) => Boolean(siblingData?.members?.docs?.length > 0),
				defaultColumns: ["name", "email", "roles"],
			},
		},
		{
			type: "join",
			name: "events",
			collection: "events",
			on: "images",
			admin: {
				allowCreate: false,
				condition: (data, siblingData) => Boolean(siblingData?.events?.docs?.length > 0),
				defaultColumns: ["title", "date"],
			},
		},
		{
			type: "join",
			name: "sponsors",
			collection: "sponsors",
			on: "logo",
			admin: {
				allowCreate: false,
				condition: (data, siblingData) => Boolean(siblingData?.sponsors?.docs?.length > 0),
				defaultColumns: ["title", "expiryDate"],
			},
		},
	],
	hooks: {
		beforeOperation: [
			({ req, operation }) => {
				if ((operation === "create" || operation === "update") && req.file) {
					const originalFilename = req.file.name;
					const extension = originalFilename.split(".").pop();
					const uniqueFilename = `${crypto.randomUUID()}.${extension}`;
					req.file.name = uniqueFilename;
				}
			},
		],
	},
	upload: {
		staticDir: "media",
		adminThumbnail: "thumbnail",
		mimeTypes: ["image/png", "image/jpeg", "image/jpg"],
	},
};
