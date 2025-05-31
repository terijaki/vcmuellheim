import { isAdmin } from "@/data/payload-access";
import type { CollectionConfig } from "payload";

export const SamsTeams: CollectionConfig = {
	slug: "sams-teams",
	labels: { plural: "Teams", singular: "Team" },
	defaultSort: "category",
	admin: {
		useAsTitle: "nameWithSeries",
		group: "SAMS",
		defaultColumns: ["name", "matchSeries_Name", "seasonTeamId", "season"],
		pagination: { defaultLimit: 50 },
	},
	access: {
		read: () => true,
		create: isAdmin,
		update: isAdmin,
		delete: isAdmin,
	},
	hooks: {
		beforeChange: [
			({ data }) => {
				data.nameWithSeries = `${data.name} (${data.matchSeries_Name})`;
				return data;
			},
		],
	},
	fields: [
		{
			name: "nameWithSeries",
			type: "text",
			admin: { readOnly: true, hidden: true },
		},
		{
			name: "name",
			label: "Name",
			type: "text",
			required: true,
		},
		{
			name: "uuid",
			type: "text",
			required: true,
			unique: true,
		},
		{
			name: "seasonTeamId",
			type: "text",
		},
		{
			name: "season",
			type: "text",
		},
		{
			name: "matchSeries_Name",
			type: "text",
		},
		{
			name: "matchSeries_Id",
			type: "text",
		},
		{
			name: "matchSeries_Uuid",
			type: "text",
		},
		{
			name: "matchSeries_AllSeasonId",
			type: "text",
		},
		{
			name: "matchSeries_Type",
			type: "text",
		},
	],
};
