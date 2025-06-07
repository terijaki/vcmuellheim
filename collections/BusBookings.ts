import { isModeratorOrBooker, isUser } from "@/data/payload-access";
import dayjs from "dayjs";
import { revalidateTag } from "next/cache";
import type { CollectionConfig } from "payload";

export const BusBookings: CollectionConfig = {
	slug: "bus-bookings",
	labels: { plural: "Bus Buchungen", singular: "Bus Buchung" },
	defaultSort: "category",
	admin: {
		useAsTitle: "id",
		group: "Resourcen",
		defaultColumns: ["schedule-start", "schedule-end", "traveler", "comment", "booker"],
		pagination: { defaultLimit: 50 },
		livePreview: {
			url: ({ data, req }) => {
				const protocol = process.env.NODE_ENV === "development" ? req.protocol : req.protocol.replace("http", "https");
				return `${protocol}//${req.host}/bus/?preview=true&date=${data.schedule.start}&date=${data.schedule.end}`;
			},
		},
	},
	access: {
		read: () => true,
		create: isUser,
		update: isModeratorOrBooker,
		delete: isModeratorOrBooker,
	},
	hooks: {
		afterChange: [
			async ({ doc }) => {
				if (doc._status === "published") revalidateTag("bus");
				return doc;
			},
		],
	},
	fields: [
		{
			name: "traveler",
			label: "Fahrer:in",
			type: "text",
			defaultValue: ({ req }) => req?.user?.name || "",
		},
		{
			name: "comment",
			label: "Kommentar",
			type: "textarea",
		},
		{
			type: "group",
			name: "schedule",
			label: "Datum",
			fields: [
				{
					name: "start",
					label: "Beginn",
					type: "date",
					required: true,
					defaultValue: () => dayjs().add(7, "days").startOf("day").toISOString(),
					admin: {
						date: {
							displayFormat: "dd.MM.yyyy",
							pickerAppearance: "dayOnly",
						},
					},
					validate: (value, { siblingData }) => {
						const sibling = siblingData as { end: string | undefined } | undefined;
						if (!value) return "Startdatum ist erforderlich.";
						if (sibling?.end && dayjs(value).startOf("day").isAfter(dayjs(sibling.end).endOf("day"))) {
							return "Das Startdatum muss vor dem Ende liegen.";
						}
						return true;
					},
				},
				{
					name: "end",
					label: "Ende",
					type: "date",
					required: true,
					defaultValue: () => dayjs().add(7, "days").startOf("day").toISOString(),
					admin: {
						date: {
							displayFormat: "dd.MM.yyyy",
							pickerAppearance: "dayOnly",
						},
					},
					validate: (value, { siblingData }) => {
						const sibling = siblingData as { start: string | undefined } | undefined;
						if (!value) return "Enddatum ist erforderlich.";
						if (sibling?.start && dayjs(sibling.start).startOf("day").isAfter(dayjs(value).endOf("day"))) {
							return "Das Startdatum muss vor dem Ende liegen.";
						}
						return true;
					},
				},
			],
		},
		{
			name: "booker",
			label: "Bucher:in",
			type: "relationship",
			relationTo: "users",
			required: true,
			admin: {
				hidden: true, // hidden in admin UI, but set automatically
			},
			access: {
				read: () => true,
				update: () => false,
				create: () => false,
			},
			defaultValue: ({ req }) => req?.user?.id,
		},
	],
};
