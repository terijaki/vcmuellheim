import PageWithHeading from "@/components/layout/PageWithHeading";
import { getBusBookings } from "@/data/bus";
import BusCalendars from "./BusCalendars";

export const dynamic = "force-dynamic";

export default async function BusPage() {
	const bookingData = await getBusBookings(false);
	const bookings = bookingData?.docs || [];

	return (
		<PageWithHeading title="Vereinsbus">
			<BusCalendars bookings={bookings} />
		</PageWithHeading>
	);
}
