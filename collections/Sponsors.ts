import dayjs from "dayjs";
import type { CollectionConfig } from "payload";
import { isModerator } from "@/data/payload-access";

export const Sponsors: CollectionConfig = {
	slug: "sponsors",
	labels: { plural: "Sponsoren", singular: "Sponsor" },
	admin: {
		useAsTitle: "name",
		group: "Inhalte",
		pagination: { defaultLimit: 50 },
	},
	access: {
		read: isModerator,
		create: isModerator,
		update: isModerator,
		delete: isModerator,
	},
	fields: [
		{
			name: "name",
			type: "text",
			required: true,
			unique: true,
		},
		{
			name: "website",
			type: "text",
		},
		{
			name: "logo",
			type: "upload",
			relationTo: "media",
			displayPreview: true,
			filterOptions: {
				mimeType: { contains: "image" },
			},
		},
		{
			name: "expiryDate",
			label: "Sponsor bis Datum",
			type: "date",
			defaultValue: () => dayjs().add(1, "year").toISOString(),
			admin: {
				description: "Nach Ablauf wird der Sponsor nicht mehr angezeigt.",
				date: {
					displayFormat: "dd.MM.yyyy",
					pickerAppearance: "dayOnly",
				},
			},
		},
	],
};
