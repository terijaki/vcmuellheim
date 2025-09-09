import type { CollectionConfig } from "payload";
import { isAdmin, isRoleAdmin } from "@/data/payload-access";

export const SamsClubs: CollectionConfig = {
	slug: "sams-clubs",
	labels: { plural: "Clubs", singular: "Club" },
	admin: {
		useAsTitle: "name",
		group: "SAMS",
		defaultColumns: ["name", "sportsclubUuid", "updatedAt"],
		pagination: { defaultLimit: 50 },
		hidden(args) {
			return !isRoleAdmin(args.user?.role);
		},
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
			name: "sportsclubUuid",
			type: "text",
			required: true,
			unique: true,
		},
		{
			name: "logo",
			type: "text",
		},
		{
			name: "associationUuid",
			type: "text",
		},
	],
};
