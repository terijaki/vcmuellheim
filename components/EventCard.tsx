import type { Event } from "@/data/payload-types";
import { Card, Text, Title } from "@mantine/core";
import dayjs from "dayjs";
import Link from "next/link";
import MapsLink from "./MapsLink";

export default function EventCard(props: Event & { dark?: boolean }) {
	const { id, title, date, address } = props;

	let dateDisplay = dayjs(date.startDate).format("DD.MM.YYYY HH:mm [Uhr]");
	if (date.endDate) {
		const isSameDay = dayjs(date.startDate).isSame(dayjs(date.endDate), "day");
		if (isSameDay) {
			dateDisplay = `${dayjs(date.startDate).format("DD.MM.YYYY HH:mm")} bis ${dayjs(date.endDate).format("HH:mm [Uhr]")}`;
		} else {
			dateDisplay = `${dayjs(date.startDate).format("DD.MM.YYYY HH:mm [Uhr]")} - ${dayjs(date.endDate).format("DD.MM.YYYY HH:mm [Uhr]")}`;
		}
	}

	return (
		<Card
			key={id}
			bg={props.dark ? "onyx" : "gray.0"}
			c={props.dark ? "white" : undefined}
			component={Link}
			href={`/termine/${id}`}
			withBorder={!props.dark}
		>
			<time data-label="datetime" dateTime={date.startDate}>
				<Text fw="bold">{dateDisplay}</Text>
			</time>
			<Title order={4} c="lion">
				{title} {(address?.name || address?.city) && `(${address.name || address.city})`}
			</Title>

			<MapsLink
				location={{
					name: address?.name,
					address: { city: address?.city, postalCode: address?.postalCode, street: address?.street },
				}}
			/>
		</Card>
	);
}
