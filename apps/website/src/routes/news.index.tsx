import { Center, Container, Loader, SimpleGrid, Stack } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import PageWithHeading from "../components/layout/PageWithHeading";
import NewsCard from "../components/NewsCard";
import { useNews } from "../lib/hooks";

export const Route = createFileRoute("/news/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { data, hasNextPage, fetchNextPage, isFetchingNextPage, error } = useNews({ limit: 4 });
	const news = data?.pages.flatMap((page) => page.items) ?? [];

	// Infinite scroll logic
	const loaderRef = useRef<HTMLDivElement | null>(null);
	useEffect(() => {
		if (!hasNextPage || isFetchingNextPage) return;
		const observer = new window.IntersectionObserver((entries) => {
			if (entries[0].isIntersecting) {
				fetchNextPage();
			}
		});
		if (loaderRef.current) {
			observer.observe(loaderRef.current);
		}
		return () => {
			if (loaderRef.current) observer.unobserve(loaderRef.current);
		};
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	return (
		<PageWithHeading title={"News Beiträge"}>
			<Container size="xl">
				<Stack>
					<SimpleGrid cols={{ base: 1, sm: 2 }}>
						{news.map((post) => (
							<NewsCard key={post.id} {...post} />
						))}
					</SimpleGrid>
					<div ref={loaderRef} style={{ marginTop: "-40vh" }} />
					{isFetchingNextPage && (
						<Center py="xl">
							<Loader />
						</Center>
					)}
					{error && (
						<Center py="xl" c="red">
							Fehler beim Laden der News: {error.message}
						</Center>
					)}
					{!hasNextPage && !isFetchingNextPage && news.length > 0 && (
						<Center py="xl" c="dimmed">
							<span>Alle News geladen.</span>
						</Center>
					)}
				</Stack>
			</Container>
		</PageWithHeading>
	);
}
