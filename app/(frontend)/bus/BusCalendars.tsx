"use client";
import { Alert, Anchor, Button, Card, Center, Container, Group, Stack, Table } from "@mantine/core";
import { Calendar, type CalendarProps, type DateStringValue } from "@mantine/dates";
import dayjs from "dayjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import CardTitle from "@/components/CardTitle";
import type { BusBooking } from "@/data/payload-types";
import { Club } from "@/project.config";

export default function BusCalendars({ bookings = [] }: { bookings: BusBooking[] }) {
	const searchParams = useSearchParams();
	const searchDates = searchParams.getAll("date").map((d) => dayjs(d).format("YYYY-MM-DD"));
	const searchPreview = searchParams.get("preview") === "true";
	const [selectedDates, setSelectedDates] = useState<DateStringValue[]>(searchDates);

	const dates = new Map<DateStringValue, string>();
	for (const booking of bookings) {
		dates.set(dayjs(booking.schedule.start).format("YYYY-MM-DD"), booking.id);
		dates.set(dayjs(booking.schedule.end).format("YYYY-MM-DD"), booking.id);
	}

	const CalendarConfig: CalendarProps = {
		highlightToday: true,
		hideOutsideDates: true,
		minDate: dayjs().startOf("day").toDate(),
		getDayProps: (date: DateStringValue) => {
			// date is a DateStringValue in "YYYY-MM-DD" format
			const hasDate = dates.has(date);
			const isToday = dayjs().isSame(date, "date");
			let bgColor;
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
		<Container size="md">
			<Stack>
				<Alert variant="white">
					Die Verfügbarkeit des Vereinsbusses wird von mehreren Funktionären gemeinsam verwaltet. Bei Fragen wende dich
					bitte an{" "}
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
				{bookings.length > 0 && (
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
									{bookings.map((booking) => {
										const start = dayjs(booking.schedule.start);
										const end = dayjs(booking.schedule.end);
										const isSelected = selectedDates.some((d) => {
											return start.isSame(dayjs(d), "date") || end.isSame(dayjs(d), "date");
										});
										return (
											<Table.Tr
												key={booking.id}
												bg={isSelected ? "turquoise" : undefined}
												c={isSelected ? "white" : undefined}
											>
												<Table.Td>
													{start.isSame(end, "date")
														? start.format("DD.MM.YYYY")
														: `${start.format("DD.MM")} - ${end.format("DD.MM.YY")}`}
												</Table.Td>
												<Table.Td>{booking.traveler}</Table.Td>
												<Table.Td>{booking.comment}</Table.Td>
											</Table.Tr>
										);
									})}
								</Table.Tbody>
							</Table>
						</Stack>
					</Card>
				)}
				{!searchPreview && (
					<Group justify="right">
						<Button component={Link} href="/admin/collections/bus-bookings" target="_blank" variant="light">
							Bearbeiten
						</Button>
					</Group>
				)}
			</Stack>
		</Container>
	);
}
