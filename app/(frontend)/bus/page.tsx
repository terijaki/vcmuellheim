"use cache";
import PageWithHeading from "@/components/layout/PageWithHeading";
import { getBusBookings } from "@/data/bus";
import { unstable_cacheTag as cacheTag } from "next/cache";
import BusCalendars from "./BusCalendars";

export default async function BusPage() {
	cacheTag("bus");

	const bookingData = await getBusBookings(false);
	const bookings = bookingData?.docs || [];

	return (
		<PageWithHeading title="Vereinsbus">
			<BusCalendars bookings={bookings} />
		</PageWithHeading>
	);
}
