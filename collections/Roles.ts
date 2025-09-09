import type { CollectionConfig } from "payload";
import { isModerator, isRoleModerator, isUser } from "@/data/payload-access";

export const Roles: CollectionConfig = {
	slug: "roles",
	labels: { plural: "Rollen", singular: "Rolle" },
	admin: {
		useAsTitle: "name",
		group: "Personen",
		pagination: { defaultLimit: 50 },
		hidden(args) {
			return !isRoleModerator(args.user?.role);
		},
	},
	access: {
		read: isUser,
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
			name: "vorstand",
			type: "checkbox",
			label: "Ist im Vorstand?",
			required: true,
		},
	],
};
