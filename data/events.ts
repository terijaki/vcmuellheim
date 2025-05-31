"use server";
import config from "@payload-config";
import { getPayload } from "payload";

const payload = await getPayload({ config });

export async function getEvents(limit?: number, page?: number) {
	try {
		const events = await payload.find({
			collection: "events",
			limit: Math.min(limit || 50, 50),
			sort: "-date.startDate", // Sort by nested startDate field
			page: page || 1,
			where: {
				"date.startDate": {
					// Reference nested field with dot notation
					greater_than_equal: new Date().toISOString(),
				},
			},
			select: {
				title: true,
				date: true,
				location: true,
			},
		});

		if (events) return events;
	} catch (error) {
		console.error("Error fetching events:", error);
	}
}

export async function getEventItem(id: string) {
	try {
		const eventsItem = await payload.findByID({
			collection: "events",
			id: id,
		});

		if (eventsItem) return eventsItem;
	} catch (error) {
		console.error(`Error fetching eventsItem: ${id}`, error);
	}
}
