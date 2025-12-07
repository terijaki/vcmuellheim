import { Group, Stack, Text, Title } from "@mantine/core";
import dayjs from "dayjs";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import type { Event } from "@/lib/db/types";
import { useTeams } from "../lib/hooks";
import { CardLink } from "./CustomLink";

export default function EventCard(props: Event & { dark?: boolean }) {
	const { id, title, startDate, endDate, location, teamIds } = props;
	const [isHovering, setIsHovering] = useState(false);
	const { data: teamsData } = useTeams();
	const teamsList = (teamIds && teamsData?.items) || [];

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
		<CardLink
			key={id}
			bg={props.dark ? "onyx" : "gray.0"}
			c={props.dark ? "white" : undefined}
			to={`/termine/$id`}
			params={{ id }}
			withBorder={!props.dark}
			onMouseEnter={() => setIsHovering(true)}
			onMouseLeave={() => setIsHovering(false)}
		>
			<Group justify="space-between">
				<Stack gap={0}>
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
					{teamsList.length > 0 && (
						<Text size="sm" c="dimmed">
							{teamsList
								.map((team) => (teamIds?.includes(team.id) ? team.name : null))
								.filter(Boolean)
								.join(", ")}
						</Text>
					)}
				</Stack>
				<Text c={isHovering ? "turquoise" : undefined}>
					<CalendarDays size={isHovering ? 44 : 32} style={{ transition: "0.3s" }} />
				</Text>
			</Group>
		</CardLink>
	);
}
