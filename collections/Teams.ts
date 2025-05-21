import { isModerator } from "@/data/payload-access";
import type { CollectionConfig } from "payload";

export const Teams: CollectionConfig = {
	slug: "teams",
	labels: { plural: "Mannschaften", singular: "Mannschaft" },
	defaultSort: "category",
	admin: {
		useAsTitle: "name",
		group: "Personen",
		defaultColumns: ["name", "category", "coach", "schedule"],
		preview: ({ id }) => `/${Teams.slug}/${id}`,
	},
	access: {
		read: () => true,
		create: isModerator,
		update: isModerator, // TODO allow coaches/poc to edit
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
			name: "gender",
			label: "Geschlecht",
			type: "select",
			options: [
				{ label: "Herren", value: "men" },
				{ label: "Damen", value: "woman" },
				{ label: "Gemischt", value: "mixed" },
			],
			required: true,
		},

		{
			name: "league",
			label: "Ligabetrieb",
			type: "checkbox",
			admin: {
				description: "Diese Mannschaft nimmt am Ligabetrieb teil.",
			},
		},
		{
			name: "description",
			label: "Beschreibung",
			type: "textarea",
		},
		{
			name: "age",
			label: "Mindestalter",
			type: "number",
		},
		{
			name: "people",
			label: "Personen",
			type: "group",
			fields: [
				{
					type: "row",
					fields: [
						{
							name: "coach",
							label: "Trainer",
							type: "relationship",
							relationTo: "members",
							hasMany: true,
							admin: {
								description: "Alle Trainer werden auf der Mannschaftskarte angezeigt; auch Co-Trainer.",
							},
						},
						{
							name: "contactPerson",
							label: "Ansprechperson",
							type: "relationship",
							relationTo: "members",
							hasMany: true,
							admin: {
								description:
									"Kontaktpersonen zusätzlich oder alternativ zu den Trainern. Diese werden auf der Mannschaftskarte angezeigt.",
							},
						},
					],
				},
			],
		},
		{
			name: "schedule",
			label: "Trainingszeiten",
			labels: { plural: "Trainingszeiten", singular: "Trainingszeit" },
			type: "array",
			admin: { initCollapsed: true },
			fields: [
				{
					name: "day",
					label: "Tag(e)",
					type: "select",
					hasMany: true,
					options: [
						{ label: "Montags", value: "monday" },
						{ label: "Dienstags", value: "tuesday" },
						{ label: "Mittwochs", value: "wednesday" },
						{ label: "Donnerstags", value: "thursday" },
						{ label: "Freitags", value: "friday" },
						{ label: "Samstags", value: "saturday" },
						{ label: "Sonntags", value: "sunday" },
					],
					required: true,
				},
				{
					name: "time",
					label: "Uhrzeit",
					type: "group",
					fields: [
						{
							type: "row",
							fields: [
								{
									name: "startTime",
									label: "Start",
									type: "date",
									required: true,
									admin: {
										date: { pickerAppearance: "timeOnly", timeFormat: "HH:mm", displayFormat: "HH:mm" },
									},
								},
								{
									name: "endTime",
									label: "Ende",
									type: "date",
									required: true,
									admin: {
										date: { pickerAppearance: "timeOnly", timeFormat: "HH:mm", displayFormat: "HH:mm" },
									},
								},
							],
						},
					],
				},
				{
					name: "location",
					label: "Ort",
					type: "relationship",
					relationTo: "locations",
					required: true,
				},
			],
		},
	],
};
