import { Card, Center, Loader, Stack, Typography } from "@mantine/core";
import { createFileRoute, notFound } from "@tanstack/react-router";
import ImageGallery from "../components/ImageGallery";
import PageWithHeading from "../components/layout/PageWithHeading";
import SharingButton from "../components/SharingButton";
import { useFileUrls, useNewsById } from "../lib/hooks";

export const Route = createFileRoute("/news/$id")({
	component: RouteComponent,
});

function RouteComponent() {
	const params = Route.useParams();
	const { data, isLoading } = useNewsById(params.id);
	if (!isLoading && !data) throw notFound();

	const { data: thumbnails } = useFileUrls(data?.imageS3Keys);

	if (!data) return <Loader />;

	return (
		<PageWithHeading title={data.title} date={new Date(data.publishedDate)}>
			<Stack>
				<Card>
					<Stack>
						<Typography>
							{/** biome-ignore lint/security/noDangerouslySetInnerHtml: Data coming from our server */}
							<div dangerouslySetInnerHTML={{ __html: data.content }} />
						</Typography>
						<ImageGallery images={thumbnails} />
					</Stack>
				</Card>

				<Center my="md">
					<SharingButton label={"Beitrag teilen"} />
				</Center>
			</Stack>
		</PageWithHeading>
	);
}
