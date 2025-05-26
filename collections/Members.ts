import { isModerator, isModeratorOrSelf } from "@/data/payload-access";
import type { CollectionConfig } from "payload";

export const Members: CollectionConfig = {
	slug: "members",
	labels: { plural: "Mitglieder", singular: "Mitglied" },
	admin: {
		useAsTitle: "name",
		group: "Personen",
		pagination: { defaultLimit: 100 },
	},
	access: {
		read: () => true,
		create: isModerator,
		update: isModeratorOrSelf,
		delete: isModeratorOrSelf,
	},
	hooks: {
		beforeChange: [
			async ({ data }) => {
				if (data.email) {
					data.email = data.email.toLowerCase();
				}
				return data;
			},
		],
	},
	fields: [
		{
			name: "name",
			type: "text",
			required: true,
			unique: true,
		},
		{
			name: "email",
			type: "email",
		},
		{
			name: "avatar",
			type: "upload",
			relationTo: "media",
			displayPreview: true,
			filterOptions: {
				mimeType: { contains: "image" },
			},
		},
		{
			name: "roles",
			label: "Rolle",
			type: "relationship",
			relationTo: "roles",
			hasMany: true,
		},
	],
};
