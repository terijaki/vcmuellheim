import { isModeratorOrAuthor, isOfficial } from "@/data/payload-access";
import type { CollectionConfig } from "payload";

export const Events: CollectionConfig = {
	slug: "events",
	labels: { plural: "Termine", singular: "Termin" },
	admin: {
		useAsTitle: "title",
		group: "Inhalte",
		preview: ({ id }) => `/${Events.slug}/${id}`,
		// description: "Offizielle SBVV Termine werden automatisch synchronisiert und brauchen hier nicht manuell eingetragen werden.",
	},
	access: {
		read: isOfficial,
		create: isOfficial,
		update: isModeratorOrAuthor,
		delete: isModeratorOrAuthor,
	},
	fields: [
		{
			name: "title",
			type: "text",
			label: "Titel",
			required: true,
		},
		{
			name: "description",
			label: "Beschreibung",
			type: "richText",
		},
		{
			name: "date",
			type: "group",
			label: "Datum",
			fields: [
				{
					type: "row",
					fields: [
						{
							name: "startDate",
							type: "date",
							label: "Start",
							required: true,
							admin: {
								date: {
									pickerAppearance: "dayAndTime",
								},
							},
						},
						{
							name: "endDate",
							type: "date",
							label: "Ende",
							admin: {
								date: {
									pickerAppearance: "dayAndTime",
								},
							},
						},
					],
				},
			],
		},
		{
			name: "location",
			label: "Ort",
			type: "text",
		},
		{
			name: "image",
			label: "Bild",
			type: "upload",
			relationTo: "media",
		},
		{
			name: "authors",
			label: "Autor(en)",
			type: "relationship",
			relationTo: "users",
			hasMany: true,
			defaultValue: ({ req: { user } }) => [user?.id],
			admin: {
				hidden: true,
			},
		},
	],
};
