import ImageGallery from "@/components/ImageGallery";
import SharingButton from "@/components/SharingButton";
import PageWithHeading from "@/components/layout/PageWithHeading";
import { getEventItem } from "@/data/events";
import { Club } from "@/project.config";
import { Card, Center, Stack, Text, Title, TypographyStylesProvider } from "@mantine/core";
import { RichText } from "@payloadcms/richtext-lexical/react";
import dayjs from "dayjs";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
	const { id } = await params;
	const data = await getEventItem(id); // load event
	return {
		title: data?.title || Club.shortName,
	};
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const event = await getEventItem(id);
	if (!event) return null; // TODO better error 404 handling

	const { title, date, description, location, images } = event;

	// filter out the thumbnail urls
	const thumbnails = images?.map((i) => (typeof i === "string" ? i : i.url)).filter((i) => typeof i === "string");

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
		<PageWithHeading title={title} subtitle={date.startDate} subtitleDate={true}>
			<Stack>
				<Card>
					<Title order={2}>Zeit</Title>
					<Text>{dateDisplay}</Text>
					{location && (
						<>
							<Title order={2}>Ort</Title>
							<Text>{location}</Text>
						</>
					)}
					{description && (
						<>
							<Title order={2}>Beschreibung</Title>
							<TypographyStylesProvider>
								<RichText data={description} />
							</TypographyStylesProvider>
						</>
					)}
					<ImageGallery images={thumbnails} />
				</Card>
				<Center>
					<SharingButton label={"Termin teilen"} />
				</Center>
			</Stack>
		</PageWithHeading>
	);
}
