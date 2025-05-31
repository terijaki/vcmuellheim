import { isAdmin } from "@/data/payload-access";
import type { CollectionConfig } from "payload";

export const SamsClubs: CollectionConfig = {
	slug: "sams-clubs",
	labels: { plural: "Clubs", singular: "Club" },
	defaultSort: "category",
	admin: {
		useAsTitle: "name",
		group: "SAMS",
		defaultColumns: ["name", "internalSportsclubId", "lsbNumber", "updatedAt"],
		pagination: { defaultLimit: 50 },
	},
	access: {
		read: () => true,
		create: isAdmin,
		update: isAdmin,
		delete: isAdmin,
	},

	fields: [
		{
			name: "name",
			label: "Name",
			type: "text",
			required: true,
		},
		{
			name: "sportsclubId",
			type: "text",
			required: true,
			unique: true,
		},
		{
			name: "lsbNumber",
			type: "text",
		},
		{
			name: "internalSportsclubId",
			type: "text",
		},
		{
			name: "logo",
			type: "text",
		},
		{
			name: "homepage",
			type: "text",
		},
	],
};
