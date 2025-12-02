import { Box, Loader, SimpleGrid, Stack, Text } from "@mantine/core";
import { useInViewport } from "@mantine/hooks";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import PageWithHeading from "../components/layout/PageWithHeading";
import PictureCard from "../components/PictureCard";
import { useGalleryImages } from "../lib/hooks";

export const Route = createFileRoute("/fotos")({
	component: RouteComponent,
});

function RouteComponent() {
	const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } = useGalleryImages({ limit: 20, format: "urls" });

	// Flatten all image URLs from all pages (already shuffled by server)
	const allImageUrls = useMemo(() => {
		if (!data?.pages) return [];

		const urls: string[] = [];
		for (const page of data.pages) {
			urls.push(...page.images);
		}

		// Remove duplicates while preserving order
		return [...new Set(urls)];
	}, [data?.pages]);

	// Infinite scroll logic using Mantine's useInViewport
	const { inViewport, ref: loaderRef } = useInViewport<HTMLDivElement>();
	useEffect(() => {
		if (inViewport && hasNextPage && !isFetchingNextPage) {
			fetchNextPage();
		}
	}, [inViewport, hasNextPage, isFetchingNextPage, fetchNextPage]);

	if (isLoading) {
		return (
			<PageWithHeading title="Fotogalerie">
				<Box p="xl">
					<Stack align="center" gap="md">
						<Loader size="lg" />
						<Text c="dimmed">Lade Fotos...</Text>
					</Stack>
				</Box>
			</PageWithHeading>
		);
	}

	if (isError) {
		return (
			<PageWithHeading title="Fotogalerie">
				<Box p="xl">
					<Text c="red" ta="center">
						Fehler beim Laden der Fotogalerie. Bitte versuche es später erneut.
					</Text>
				</Box>
			</PageWithHeading>
		);
	}

	if (allImageUrls.length === 0) {
		return (
			<PageWithHeading title="Fotogalerie">
				<Box p="xl">
					<Text c="dimmed" ta="center">
						Noch keine Fotos vorhanden.
					</Text>
				</Box>
			</PageWithHeading>
		);
	}

	return (
		<PageWithHeading title="Fotogalerie">
			<SimpleGrid cols={{ base: 1, xs: 2, sm: 3, md: 4, lg: 5 }} spacing="md" p="md">
				{allImageUrls.map((imageUrl) => (
					<PictureCard key={imageUrl} url={imageUrl} />
				))}
			</SimpleGrid>

			{/* Loader sentinel for infinite scroll */}
			<Box ref={loaderRef} py="xl">
				{isFetchingNextPage && (
					<Stack align="center" gap="md">
						<Loader size="md" />
						<Text c="dimmed" size="sm">
							Lade weitere Fotos...
						</Text>
					</Stack>
				)}
				{!hasNextPage && allImageUrls.length > 0 && (
					<Text c="dimmed" ta="center" size="sm">
						Alle Fotos geladen ({allImageUrls.length} Bilder)
					</Text>
				)}
			</Box>
		</PageWithHeading>
	);
}
