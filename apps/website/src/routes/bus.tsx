import { Alert, Anchor, Button, Card, Center, Container, Group, Stack, Table } from "@mantine/core";
import { Calendar, type CalendarProps, type DateStringValue } from "@mantine/dates";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useState } from "react";
import { buildServiceUrl } from "@/apps/shared/lib";
import { Club } from "@/project.config";
import CardTitle from "../components/CardTitle";
import PageWithHeading from "../components/layout/PageWithHeading";
import { useBusBookings } from "../lib/hooks";

export const Route = createFileRoute("/bus")({
	component: RouteComponent,
});

function RouteComponent() {
	const { data, isLoading, error } = useBusBookings();

	if (error) throw error;

	const bookings = (data?.items || [])?.sort((a, b) => dayjs(a.from).unix() - dayjs(b.from).unix());
	const bookingsFuture = bookings.filter((b) => dayjs(b.to).isAfter(dayjs()));

	const [selectedDates, setSelectedDates] = useState<DateStringValue[]>([]);

	const dates = new Map<DateStringValue, string>();
	for (const booking of bookings) {
		dates.set(dayjs(booking.from).format("YYYY-MM-DD"), booking.id);
		dates.set(dayjs(booking.to).format("YYYY-MM-DD"), booking.id);
	}

	const CalendarConfig: CalendarProps = {
		highlightToday: true,
		hideOutsideDates: true,
		minDate: dayjs().startOf("day").toDate(),
		getDayProps: (date: DateStringValue) => {
			// date is a DateStringValue in "YYYY-MM-DD" format
			const hasDate = dates.has(date);
			const isToday = dayjs().isSame(date, "date");
			let bgColor: string | undefined;
			if (hasDate) bgColor = "onyx";
			if (isToday) bgColor = "lion";
			if (hasDate && isToday) bgColor = "blumine";
			if (selectedDates.includes(date)) bgColor = "turquoise";

			return {
				selected: selectedDates.includes(date),
				bg: bgColor,
				c: bgColor ? "white" : undefined,
				onClick: () => {
					if (hasDate) {
						if (selectedDates.includes(date)) {
							setSelectedDates((current) => current.filter((d) => !dayjs(d).isSame(date, "date")));
						} else {
							setSelectedDates((current) => [...current, date]);
						}
					}
				},
			};
		},
	};

	return (
		<PageWithHeading title="Vereinsbus" isLoading={isLoading}>
			<Container size="md">
				<Stack>
					<Alert variant="white">
						Die Verfügbarkeit des Vereinsbusses wird von mehreren Funktionären gemeinsam verwaltet. Bei Fragen wende dich bitte an{" "}
						<Anchor size="sm" href={`mailto:${Club.email}`} underline="never">
							{Club.email}
						</Anchor>
						.
					</Alert>
					<Card>
						<Center>
							<Calendar {...CalendarConfig} numberOfColumns={1} hiddenFrom="sm" />
							<Calendar {...CalendarConfig} numberOfColumns={2} visibleFrom="sm" hiddenFrom="md" />
							<Calendar {...CalendarConfig} numberOfColumns={3} visibleFrom="md" />
						</Center>
					</Card>
					{bookingsFuture.length > 0 && (
						<Card>
							<Stack gap="xs">
								<CardTitle>Buchungen</CardTitle>
								<Table striped highlightOnHover withRowBorders>
									<Table.Thead>
										<Table.Tr>
											<Table.Th>Datum</Table.Th>
											<Table.Th>Fahrer:in</Table.Th>
											<Table.Th>Kommentar</Table.Th>
										</Table.Tr>
									</Table.Thead>
									<Table.Tbody>
										{bookingsFuture?.map((booking) => {
											const start = dayjs(booking.from);
											const end = dayjs(booking.to);
											const isSelected = selectedDates.some((d) => {
												return start.isSame(dayjs(d), "date") || end.isSame(dayjs(d), "date");
											});
											return (
												<Table.Tr key={booking.id} bg={isSelected ? "turquoise" : undefined} c={isSelected ? "white" : undefined}>
													<Table.Td>{start.isSame(end, "date") ? start.format("DD.MM.YYYY") : `${start.format("DD.MM")} - ${end.format("DD.MM.YY")}`}</Table.Td>
													<Table.Td>{booking.driver}</Table.Td>
													<Table.Td>{booking.comment}</Table.Td>
												</Table.Tr>
											);
										})}
									</Table.Tbody>
								</Table>
							</Stack>
						</Card>
					)}

					<Group justify="right">
						<Button component="a" href={buildServiceUrl("admin")} target="_blank" variant="light">
							Bearbeiten
						</Button>
					</Group>
				</Stack>
			</Container>
		</PageWithHeading>
	);
}
