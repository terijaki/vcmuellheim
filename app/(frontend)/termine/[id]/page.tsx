import CardTitle from "@/components/CardTitle";
import ImageGallery from "@/components/ImageGallery";
import MapsLink from "@/components/MapsLink";
import SharingButton from "@/components/SharingButton";
import PageWithHeading from "@/components/layout/PageWithHeading";
import { getEventItem } from "@/data/events";
import { Club } from "@/project.config";
import { Card, Center, Grid, GridCol, Stack, Text, TypographyStylesProvider } from "@mantine/core";
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

	const { title, date, description, address, images } = event;

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

	const hasAddress = address && (address.name || address.street || address.postalCode || address.city);

	return (
		<PageWithHeading title={title} date={new Date(date.startDate)}>
			<Stack gap="lg">
				<Card>
					<Grid gutter="lg">
						<GridCol span={{ base: 12, sm: 5, md: 4 }}>
							<Stack>
								<Stack gap={0}>
									<CardTitle>Zeit</CardTitle>
									<Text>{dateDisplay}</Text>
								</Stack>
								{hasAddress && (
									<Stack gap={0}>
										<CardTitle>Ort</CardTitle>
										<MapsLink location={address} />
										<Stack gap={0}>
											<Text>{address?.name}</Text>
											<Text>{address?.street}</Text>
											<Text>{address?.city}</Text>
											<Text>{address?.postalCode}</Text>
										</Stack>
									</Stack>
								)}
							</Stack>
						</GridCol>
						<GridCol span={{ base: 12, sm: 7, md: 8 }}>
							{description && description.root.children.length > 0 && (
								<Stack gap={0}>
									<CardTitle>Beschreibung</CardTitle>
									<TypographyStylesProvider>
										<RichText data={description} />
									</TypographyStylesProvider>
								</Stack>
							)}
						</GridCol>
					</Grid>
				</Card>
				{thumbnails && (
					<Card>
						<CardTitle>Fotos</CardTitle>
						<ImageGallery images={thumbnails} />
					</Card>
				)}
				<Center>
					<SharingButton label={"Termin teilen"} />
				</Center>
			</Stack>
		</PageWithHeading>
	);
}
