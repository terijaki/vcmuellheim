import { Card, Text, Title } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import type { Event } from "@/lib/db/types";

export default function EventCard(props: Event & { dark?: boolean }) {
	const { id, title, startDate, endDate, location } = props;

	let dateDisplay = dayjs(startDate).format("DD.MM.YYYY HH:mm [Uhr]");
	if (endDate) {
		const isSameDay = dayjs(startDate).isSame(dayjs(endDate), "day");
		if (isSameDay) {
			dateDisplay = `${dayjs(startDate).format("DD.MM.YYYY HH:mm")} bis ${dayjs(endDate).format("HH:mm [Uhr]")}`;
		} else {
			dateDisplay = `${dayjs(startDate).format("DD.MM.YYYY HH:mm [Uhr]")} - ${dayjs(endDate).format("DD.MM.YYYY HH:mm [Uhr]")}`;
		}
	}

	return (
		<Card key={id} bg={props.dark ? "onyx" : "gray.0"} c={props.dark ? "white" : undefined} component={Link} to={`/termine/${id}`} withBorder={!props.dark}>
			<time data-label="datetime" dateTime={startDate}>
				<Text fw="bold">{dateDisplay}</Text>
			</time>
			<Title order={4} c="lion">
				{title}
			</Title>
			{location && (
				<Text size="sm" c="dimmed">
					{location}
				</Text>
			)}
		</Card>
	);
}
