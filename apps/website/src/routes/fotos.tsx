import { AspectRatio, Box, Card, Image, Loader, SimpleGrid, Stack, Text } from "@mantine/core";
import { useInViewport } from "@mantine/hooks";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import PageWithHeading from "../components/layout/PageWithHeading";
import { useFileUrlsMap, useGalleryImages } from "../lib/hooks";

export const Route = createFileRoute("/fotos")({
	component: RouteComponent,
});

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

function RouteComponent() {
	const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } = useGalleryImages({ limit: 20 });

	// Infinite scroll logic using Mantine's useInViewport
	const { inViewport, ref: loaderRef } = useInViewport<HTMLDivElement>();
	useEffect(() => {
		if (inViewport && hasNextPage && !isFetchingNextPage) {
			fetchNextPage();
		}
	}, [inViewport, hasNextPage, isFetchingNextPage, fetchNextPage]);

	// Flatten and shuffle all image S3 keys from all pages
	const allImageKeys = useMemo(() => {
		if (!data?.pages) return [];

		const keys: string[] = [];
		for (const page of data.pages) {
			keys.push(...page.imageS3Keys);
		}

		// Remove duplicates and shuffle
		const uniqueKeys = [...new Set(keys)];
		return shuffleArray(uniqueKeys);
	}, [data?.pages]);

	// Fetch all URLs in one go (using the map endpoint for efficiency)
	const { data: imageUrlsMap } = useFileUrlsMap(allImageKeys);

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

	if (allImageKeys.length === 0) {
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
				{allImageKeys.map((s3Key) => {
					const imageUrl = imageUrlsMap?.[s3Key];
					if (!imageUrl) return null;

					return (
						<AspectRatio key={s3Key} ratio={1}>
							<Card shadow="sm" component="a" href={imageUrl} target="_blank" rel="noopener noreferrer" p={0} style={{ overflow: "hidden" }}>
								<Image
									src={imageUrl}
									alt=""
									style={{
										width: "100%",
										height: "100%",
										objectFit: "cover",
										transition: "transform 0.3s ease",
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.transform = "scale(1.05)";
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.transform = "scale(1)";
									}}
								/>
							</Card>
						</AspectRatio>
					);
				})}
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
				{!hasNextPage && allImageKeys.length > 0 && (
					<Text c="dimmed" ta="center" size="sm">
						Alle Fotos geladen ({allImageKeys.length} Bilder)
					</Text>
				)}
			</Box>
		</PageWithHeading>
	);
}
