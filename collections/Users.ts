import type { CollectionConfig } from "payload";
import { isAdmin, isAdminOrSelf, isFieldAdmin, isRoleAdmin } from "@/data/payload-access";

export const Users: CollectionConfig = {
	slug: "users",
	labels: { plural: "Benutzer", singular: "Benutzer" },
	admin: {
		useAsTitle: "name",
		group: "System",
		defaultColumns: ["email", "name", "role"],
		pagination: { defaultLimit: 50 },
		hidden(args) {
			return !isRoleAdmin(args.user?.role);
		},
	},
	access: {
		read: isAdminOrSelf,
		delete: isAdminOrSelf,
		update: isAdminOrSelf,
		create: isAdmin,
		unlock: isAdmin,
	},
	auth: true,
	fields: [
		{
			// Email added by default
			name: "email",
			type: "email",
			required: true,
			unique: true,
			hooks: {
				afterChange: [
					({ value }) => {
						return value.toLowerCase();
					},
				],
			},
		},
		{
			type: "text",
			name: "name",
			label: "Name",
			required: false,
		},
		{
			name: "role",
			label: "Berechtigungsstufe",
			type: "radio",
			required: true,
			saveToJWT: true,
			access: {
				read: () => true,
				create: isFieldAdmin,
				update: isFieldAdmin,
			},
			defaultValue: "none",
			options: [
				{ label: "Admin", value: "admin" },
				{ label: "Moderator", value: "moderator" },
				{ label: "Funktionär", value: "official" },
				{ label: "Keine", value: "none" },
			],
			admin: {
				description:
					"Administratoren haben Zugriff auf alle Inhalte und Einstellungen.\nModeratoren können Inhalte erstellen und bearbeiten, aber keine Einstellungen oder neue Benutzer erstellen ändern.\nFunktionäre können Inhalte erstellen und die eigenen Inhalte bearbeiten.",
			},
		},
	],
};
