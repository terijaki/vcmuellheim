import type { CollectionConfig } from "payload";
import { isModerator, isRoleModerator } from "@/data/payload-access";
import { Club } from "@/project.config";

export const Locations: CollectionConfig = {
	slug: "locations",
	labels: { plural: "Orte", singular: "Ort" },
	defaultSort: "name",
	admin: {
		useAsTitle: "name",
		group: "Resourcen",
		pagination: { defaultLimit: 50 },
		hidden(args) {
			return !isRoleModerator(args.user?.role);
		},
	},
	access: {
		read: () => true,
		create: isModerator,
		update: isModerator,
		delete: isModerator,
	},
	fields: [
		{
			name: "name",
			label: "Name",
			type: "text",
			required: true,
		},
		{
			name: "description",
			label: "Beschreibung",
			type: "text",
		},
		{
			name: "address",
			label: "Adresse",
			type: "group",
			fields: [
				{
					name: "street",
					label: "Straße",
					type: "text",
				},
				{
					type: "row",
					fields: [
						{
							name: "postalCode",
							label: "PLZ",
							type: "number",
							defaultValue: Club.postalCode,
							min: 1000,
							max: 99999,
						},
						{
							name: "city",
							label: "Stadt",
							type: "text",
							defaultValue: Club.city,
						},
					],
				},
			],
		},
	],
};
