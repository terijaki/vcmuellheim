import { Card, Center, Grid, GridCol, Stack, Text } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import CardTitle from "../components/CardTitle";
import CenteredLoader from "../components/CenteredLoader";
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
		return (
			<PageWithHeading title="Veranstaltung nicht gefunden">
				<Card>
					<CardTitle>Veranstaltung nicht gefunden</CardTitle>
					<Text>Diese Veranstaltung existiert nicht oder wurde entfernt.</Text>
				</Card>
			</PageWithHeading>
		);
	}

	const { title, startDate, endDate, description, location } = event;

	// Format date display
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
		<PageWithHeading title={title} date={new Date(startDate)}>
			<Stack gap="lg">
				<Card>
					<Grid gutter="lg">
						<GridCol span={{ base: 12, sm: 5, md: 4 }}>
							<Stack>
								<Stack gap={0}>
									<CardTitle>Zeit</CardTitle>
									<Text>{dateDisplay}</Text>
								</Stack>
								{location && (
									<Stack gap={0}>
										<CardTitle>Ort</CardTitle>
										<Text>{location}</Text>
									</Stack>
								)}
							</Stack>
						</GridCol>
						{description && (
							<GridCol span={{ base: 12, sm: 7, md: 8 }}>
								<Stack gap={0}>
									<CardTitle>Beschreibung</CardTitle>
									<Text style={{ whiteSpace: "pre-wrap" }}>{description}</Text>
								</Stack>
							</GridCol>
						)}
					</Grid>
				</Card>
				<Center>
					<SharingButton label="Termin teilen" />
				</Center>
			</Stack>
		</PageWithHeading>
	);
}
