import { isModeratorOrAuthor, isOfficial } from "@/data/payload-access";
import type { CollectionConfig } from "payload";

export const Events: CollectionConfig = {
	slug: "events",
	labels: { plural: "Termine", singular: "Termin" },
	admin: {
		useAsTitle: "title",
		group: "Inhalte",
		pagination: { defaultLimit: 100 },
		preview: ({ id }) => `/termine/${id}`,
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
									displayFormat: "eeee dd.MM.yyyy HH:mm",
									timeFormat: "HH:mm",
									timeIntervals: 15,
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
									displayFormat: "eeee dd.MM.yyyy HH:mm",
									timeFormat: "HH:mm",
									timeIntervals: 15,
								},
							},
						},
					],
				},
			],
		},
		{
			name: "address",
			label: "Adresse",
			type: "group",
			fields: [
				{
					name: "name",
					label: "Name",
					type: "text",
				},
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
							min: 1000,
							max: 99999,
						},
						{
							name: "city",
							label: "Stadt",
							type: "text",
						},
					],
				},
			],
		},
		{
			name: "images",
			label: "Bilder",
			type: "upload",
			relationTo: "media",
			hasMany: true,
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
