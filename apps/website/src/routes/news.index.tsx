import { Alert, Center, Container, Loader, SimpleGrid, Stack } from "@mantine/core";
import { useInViewport } from "@mantine/hooks";
import { createFileRoute } from "@tanstack/react-router";
import { ServerCrash } from "lucide-react";
import { useEffect } from "react";
import EntityNotFound from "../components/EntityNotFound";
import PageWithHeading from "../components/layout/PageWithHeading";
import NewsCard from "../components/NewsCard";
import { useNews } from "../lib/hooks";

export const Route = createFileRoute("/news/")({
	component: RouteComponent,
});

const BATCH_SIZE = 8;

function RouteComponent() {
	const { data, hasNextPage, fetchNextPage, isFetchingNextPage, error, isLoading } = useNews({ limit: BATCH_SIZE });
	const news = data?.pages.flatMap((page) => page.items) ?? [];

	// Infinite scroll logic using Mantine's useInViewport
	const { inViewport, ref: loaderRef } = useInViewport<HTMLAnchorElement>();
	useEffect(() => {
		if (inViewport && hasNextPage && !isFetchingNextPage) {
			fetchNextPage();
		}
	}, [inViewport, hasNextPage, isFetchingNextPage, fetchNextPage]);

	if (data && news.length === 0) {
		return <EntityNotFound entityName="News Beiträge" title="Ladefehler" description="Es konnten keine News geladen werden." />;
	}

	return (
		<PageWithHeading title="News Beiträge" description="Lese die neuesten Nachrichten und Updates vom Volleyballclub Müllheim">
			<Container size="xl">
				<Stack>
					<SimpleGrid cols={{ base: 1, sm: 2 }}>
						{news.map((post, index) => (
							<NewsCard key={post.id} {...post} ref={index <= news.length - BATCH_SIZE ? loaderRef : undefined} />
						))}
					</SimpleGrid>
					{(isLoading || isFetchingNextPage) && (
						<Center py="xl">
							<Loader size="xl" />
						</Center>
					)}
					{error && (
						<Center py="xl">
							<Alert variant="light" color="red" radius="md" title="Fehler beim Laden der News" icon={<ServerCrash />}>
								{error.message}
							</Alert>
						</Center>
					)}
				</Stack>
			</Container>
		</PageWithHeading>
	);
}
