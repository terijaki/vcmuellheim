import { BackgroundImage, Box, Container, Loader, Overlay, SimpleGrid, Stack } from "@mantine/core";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { Suspense } from "react";
import SectionHeading from "@/components/layout/SectionHeading";
import { getRecentInstagramPosts } from "@/utils/social/instagram";
import InstagramCard from "../InstagramCard";
import ScrollAnchor from "./ScrollAnchor";

export default async function HomeInstagram() {
	"use cache";
	cacheLife("minutes");

	const instagrams = await getRecentInstagramPosts();
	if (!instagrams || instagrams.length === 0) return null;

	return (
		<Box bg="onyx">
			<BackgroundImage src={"/images/backgrounds/pageheading.jpg"} py="md" style={{ zIndex: 0 }} pos="relative">
				<Container size="xl" py="md" px={{ base: "lg", md: "xl" }}>
					<ScrollAnchor name="instagram" />
					<Stack>
						<Suspense fallback={<Loader />}>
							<Stack>
								<SectionHeading text="Instagram" color="white" />
								<SimpleGrid cols={{ base: 1, md: 2 }}>
									{instagrams.map((post) => {
										if (!post) return null; // skip null posts (errors)
										return <InstagramCard key={post.id} {...post} />;
									})}
								</SimpleGrid>
							</Stack>
						</Suspense>
					</Stack>
				</Container>
				<Overlay backgroundOpacity={0.98} color="var(--mantine-color-onyx-filled)" blur={2} zIndex={-1} />
			</BackgroundImage>
		</Box>
	);
}
