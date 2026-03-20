import { Card, Center, Loader, Stack, Typography } from "@mantine/core";
import { createFileRoute, notFound } from "@tanstack/react-router";
import ImageGallery from "@webapp/components/ImageGallery";
import PageWithHeading from "@webapp/components/layout/PageWithHeading";
import SharingButton from "@webapp/components/SharingButton";
import { useFileUrls, useNewsById } from "@/apps/webapp/src/hooks/dataQueries";

export const Route = createFileRoute("/_layout/news/$id")({
	component: RouteComponent,
});

function RouteComponent() {
	const params = Route.useParams();
	const { data, isLoading } = useNewsById(params.id);
	if (!isLoading && !data) throw notFound();

	const { data: thumbnails } = useFileUrls(data?.imageS3Keys);

	if (!data) return <Loader />;

	return (
		<PageWithHeading
			title={data.title}
			date={new Date(data.createdAt)}
			description={data.excerpt || data.content?.substring(0, 160)}
			image={thumbnails?.[0]}
			type="article"
			publishedAt={data.createdAt}
			updatedAt={data.updatedAt}
		>
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
