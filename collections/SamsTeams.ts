import type { CollectionConfig } from "payload";
import { isAdmin, isRoleAdmin } from "@/data/payload-access";

export const SamsTeams: CollectionConfig = {
	slug: "sams-teams",
	labels: { plural: "Teams", singular: "Team" },
	admin: {
		useAsTitle: "nameWithSeries",
		group: "SAMS",
		defaultColumns: ["nameWithSeries", "uuid", "leagueUuid", "updatedAt"],
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
	hooks: {
		beforeChange: [
			({ data }) => {
				data.nameWithSeries = `${data.name} (${data.leagueName})`;
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
			name: "associationUuid",
			type: "text",
		},
		{
			name: "sportsclubUuid",
			type: "text",
		},
		{
			name: "leagueUuid",
			type: "text",
		},
		{
			name: "leagueName",
			type: "text",
		},
		{
			name: "seasonUuid",
			type: "text",
		},
		{
			name: "seasonName",
			type: "text",
		},
	],
};
