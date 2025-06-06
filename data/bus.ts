"server-only";
import type { Where } from "payload";
import { payload } from "./payload-client";

export async function getBusBookings(includePast = false) {
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
