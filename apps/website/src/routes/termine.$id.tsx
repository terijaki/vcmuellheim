import { Badge, Card, Center, Container, Divider, Group, Stack, Text, ThemeIcon } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import { Calendar, Clock, Info, MapPin } from "lucide-react";
import CenteredLoader from "../components/CenteredLoader";
import EntityNotFound from "../components/EntityNotFound";
import PageWithHeading from "../components/layout/PageWithHeading";
import SharingButton from "../components/SharingButton";
import { useEventById } from "../lib/hooks";

export const Route = createFileRoute("/termine/$id")({
	component: RouteComponent,
});

function RouteComponent() {
	const { id } = Route.useParams();
	const { data: event, isLoading, error } = useEventById(id);

	if (isLoading) {
		return (
			<PageWithHeading title="Veranstaltung">
				<CenteredLoader text="Lade Veranstaltung..." />
			</PageWithHeading>
		);
	}

	if (error || !event) {
		return <EntityNotFound entityName="Veranstaltung" title="Veranstaltung nicht gefunden" description="Diese Veranstaltung existiert nicht oder wurde entfernt." />;
	}

	const { title, startDate, endDate, description, location } = event;

	// Format date display
	const startDayjs = dayjs(startDate);
	const endDayjs = endDate ? dayjs(endDate) : null;
	const isSameDay = endDayjs ? startDayjs.isSame(endDayjs, "day") : true;

	// Check if event is upcoming, ongoing, or past
	const now = dayjs();
	const isUpcoming = startDayjs.isAfter(now);
	const isOngoing = endDayjs ? now.isAfter(startDayjs) && now.isBefore(endDayjs) : false;
	const isPast = endDayjs ? endDayjs.isBefore(now) : startDayjs.isBefore(now);

	return (
		<PageWithHeading title={title} date={new Date(startDate)}>
			<Container>
				<Stack gap="lg">
					<Card withBorder shadow="md" p="xl" radius="md">
						<Stack gap="xl">
							{/* Status Badge */}
							<Group justify="space-between" align="flex-start">
								<Group>
									{isUpcoming && (
										<Badge size="lg" variant="light" color="turquoise">
											Bevorstehend
										</Badge>
									)}
									{isOngoing && (
										<Badge size="lg" variant="light" color="gamboge">
											Läuft gerade
										</Badge>
									)}
									{isPast && (
										<Badge size="lg" variant="light" color="onyx">
											Vergangen
										</Badge>
									)}
								</Group>
							</Group>
							<Divider />
							{/* Date and Time */}
							<Group align="flex-start" wrap="nowrap">
								<ThemeIcon size={42} radius="md" variant="light" color="blumine">
									<Calendar size={24} />
								</ThemeIcon>
								<Stack gap={4} flex={1}>
									<Text fw={600} size="sm" c="dimmed">
										Datum & Uhrzeit
									</Text>
									<Text size="lg">{startDayjs.format("dddd, DD.MM.YYYY")}</Text>
									<Group gap="xs">
										<Clock size={16} style={{ opacity: 0.6 }} />
										<Text size="md" c="dimmed">
											{isSameDay && endDayjs
												? `${startDayjs.format("HH:mm")} - ${endDayjs.format("HH:mm")} Uhr`
												: endDayjs
													? `${startDayjs.format("HH:mm")} Uhr - ${endDayjs.format("DD.MM.YYYY HH:mm")} Uhr`
													: `${startDayjs.format("HH:mm")} Uhr`}
										</Text>
									</Group>
								</Stack>
							</Group>
							{/* Location */}
							{location && (
								<>
									<Divider />
									<Group align="flex-start" wrap="nowrap">
										<ThemeIcon size={42} radius="md" variant="light" color="turquoise">
											<MapPin size={24} />
										</ThemeIcon>
										<Stack gap={4} flex={1}>
											<Text fw={600} size="sm" c="dimmed">
												Veranstaltungsort
											</Text>
											<Text size="lg">{location}</Text>
										</Stack>
									</Group>
								</>
							)}
							{/* Description */}
							{description && (
								<>
									<Divider />
									<Group align="flex-start" wrap="nowrap">
										<ThemeIcon size={42} radius="md" variant="light" color="gamboge">
											<Info size={24} />
										</ThemeIcon>
										<Stack gap={4} flex={1}>
											<Text fw={600} size="sm" c="dimmed">
												Beschreibung
											</Text>
											<Text size="md" style={{ whiteSpace: "pre-wrap" }}>
												{description}
											</Text>
										</Stack>
									</Group>
								</>
							)}
						</Stack>
					</Card>
					<Center>
						<SharingButton label="Termin teilen" />
					</Center>
				</Stack>
			</Container>
		</PageWithHeading>
	);
}
