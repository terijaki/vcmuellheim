import { isModerator } from "@/data/payload-access";
import { Instagram } from "@/project.config";
import { slugify } from "@/utils/slugify";
import type { CollectionConfig } from "payload";

export const Teams: CollectionConfig = {
	slug: "teams",
	labels: { plural: "Mannschaften", singular: "Mannschaft" },
	defaultSort: "category",
	admin: {
		useAsTitle: "name",
		group: "Personen",
		defaultColumns: ["name", "category", "coaches", "schedules"],
		pagination: { defaultLimit: 50 },
		preview: ({ slug }) => `/${Teams.slug}/${slug}`,
		livePreview: {
			url: ({ data, req }) => `${req.protocol}//${req.host}/teams/${data.slug}?preview=true`,
		},
	},
	access: {
		read: () => true,
		create: isModerator,
		update: isModerator, // TODO allow coaches/poc to edit
		delete: isModerator,
	},
	hooks: {
		beforeChange: [
			({ data }) => {
				if (data.name) data.slug = slugify(data.name, true);
				if (data.instagram) data.instagram = data.instagram.toLowerCase().trim();
				return data;
			},
		],
	},
	fields: [
		{
			name: "name",
			label: "Name",
			type: "text",
			required: true,
			unique: true,
		},
		{
			type: "row",
			fields: [
				{
					name: "gender",
					label: "Geschlecht",
					type: "select",
					options: [
						{ label: "Männlich", value: "men" },
						{ label: "Weiblich", value: "woman" },
						{ label: "Gemischt", value: "mixed" },
					],
					required: true,
					admin: {
						width: "66%",
					},
				},
				{
					name: "age",
					label: "Mindestalter",
					type: "number",
					min: 1,
					admin: {
						width: "33%",
					},
				},
			],
		},
		{
			name: "slug",
			type: "text",
			admin: {
				description: "Automatisch generiert vom Namen",
				readOnly: true,
				hidden: true,
			},
		},
		{
			name: "league",
			label: "Ligabetrieb",
			type: "select",
			options: [
				{ label: "1. Bundesliga", value: "1. Bundesliga" },
				{ label: "2. Bundesliga", value: "2. Bundesliga" },
				{ label: "Dritte Liga", value: "Dritte Liga" },
				{ label: "Regionalliga", value: "Regionalliga" },
				{ label: "Oberliga", value: "Oberliga" },
				{ label: "Verbandsliga", value: "Verbandsliga" },
				{ label: "Landesliga", value: "Landesliga" },
				{ label: "Bezirksliga", value: "Bezirksliga" },
				{ label: "Bezirksklasse", value: "Bezirksklasse" },
				{ label: "Kreisliga", value: "Kreisliga" },
				{ label: "Kreisklasse", value: "Kreisklasse" },
			],
			admin: {
				description: "Für Mannschaften die nicht am Ligabetrieb teilnehmen, lasse das Feld frei.",
			},
		},
		{
			name: "sbvvTeam",
			type: "relationship",
			relationTo: "sams-teams",
			admin: {
				condition: (data) => Boolean(data?.league),
				description: "Verknüpfung zu einem Team im SBVV-System. Wird für den Spielplan und die Ergebnisse benötigt.",
				sortOptions: "nameWithSeries",
			},
		},
		{
			name: "description",
			label: "Beschreibung",
			type: "textarea",
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
							name: "coaches",
							label: "Trainer",
							type: "relationship",
							relationTo: "members",
							hasMany: true,
							admin: {
								description: "Alle Trainer werden auf der Mannschaftskarte angezeigt; auch Co-Trainer.",
							},
						},
						{
							name: "contactPeople",
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
			name: "schedules",
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
						{ label: "montags", value: "montags" },
						{ label: "dienstags", value: "dienstags" },
						{ label: "mittwochs", value: "mittwochs" },
						{ label: "donnerstags", value: "donnerstags" },
						{ label: "freitags", value: "freitags" },
						{ label: "samstags", value: "samstags" },
						{ label: "sonntags", value: "sonntags" },
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
		{
			name: "images",
			type: "upload",
			relationTo: "media",
			hasMany: true,
		},
		{
			name: "instagram",
			label: "Instagram",
			type: "text",
			admin: {
				description: `Instagram-Handle der Mannschaft, ohne @-Zeichen (e.g. "tagesschau"). Wird auf der Mannschaftskarte angezeigt und Beiträge der letzten ${Instagram.recentPostTimeframe} Tage werden automatisch eingebunden. Die Synchronisierung kann bis zu 24 Stunden dauern.`,
			},
		},
	],
};
