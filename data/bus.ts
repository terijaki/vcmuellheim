"server-only";
import { unstable_cacheLife as cacheLife, unstable_cacheTag as cacheTag } from "next/cache";
import type { Where } from "payload";
import { payload } from "./payload-client";

export async function getBusBookings(includePast = false) {
	"use cache";
	cacheTag("bus");
	cacheLife("days");

	try {
		const whereFilter: Where = !includePast
			? {
					"schedule.start": {
						greater_than_equal: new Date().toISOString(),
					},
				}
			: {};

		const bookings = await payload.find({
			collection: "bus-bookings",
			limit: 100,
			sort: "schedule.start",
			where: whereFilter,
		});

		if (bookings) return bookings;
	} catch (error) {
		console.error("Error fetching bus bookings:", error);
	}
}
