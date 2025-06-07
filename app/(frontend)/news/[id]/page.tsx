import ImageGallery from "@/components/ImageGallery";
import SharingButton from "@/components/SharingButton";
import PageWithHeading from "@/components/layout/PageWithHeading";
import { RefreshRouteOnSave } from "@/components/payload/RefreshRouterOnSave";
import { getNewsItem } from "@/data/news";
import { Club } from "@/project.config";
import { Card, Center, Stack, TypographyStylesProvider } from "@mantine/core";
import { RichText } from "@payloadcms/richtext-lexical/react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
	const { id } = await params;
	const data = await getNewsItem(id);
	return {
		title: data?.title || Club.shortName,
	};
}

export default async function NewsPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const data = await getNewsItem(id);
	if (!data) notFound();

	// filter out the thumbnail urls
	const thumbnails = data.images?.map((i) => (typeof i === "string" ? i : i.url)).filter((i) => typeof i === "string");

	return (
		<PageWithHeading title={data.title} date={new Date(data.publishedDate)}>
			<RefreshRouteOnSave />
			<Stack>
				<Card>
					<Stack>
						<TypographyStylesProvider>
							<RichText data={data.content} />
						</TypographyStylesProvider>
						<ImageGallery images={thumbnails} />
					</Stack>
				</Card>

				<Center>
					<SharingButton label={"Beitrag teilen"} />
				</Center>
			</Stack>
		</PageWithHeading>
	);
}
