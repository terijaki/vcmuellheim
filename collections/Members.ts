import { revalidateTag } from "next/cache";
import type { CollectionConfig } from "payload";
import { isModerator, isModeratorOrSelf } from "@/data/payload-access";

export const Members: CollectionConfig = {
	slug: "members",
	labels: { plural: "Mitglieder", singular: "Mitglied" },
	admin: {
		useAsTitle: "name",
		group: "Personen",
		pagination: { defaultLimit: 50 },
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
		afterChange: [
			async ({ doc }) => {
				if (doc._status === "published") revalidateTag("members");
				return doc;
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
			label: "E-Mail",
			type: "email",
		},
		{
			name: "phone",
			label: "Telefon",
			type: "text",
		},
		{
			name: "roles",
			label: "Rolle",
			type: "relationship",
			relationTo: "roles",
			hasMany: true,
			admin: {
				sortOptions: "name",
			},
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
	],
};
