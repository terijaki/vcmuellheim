import { BackgroundImage, Box, Container, Overlay, SimpleGrid, Stack } from "@mantine/core";
import type { BeholdPost } from "@/lambda/social/types";
import InstagramCard from "../InstagramCard";
import SectionHeading from "../layout/SectionHeading";
import ScrollAnchor from "./ScrollAnchor";

interface HomeInstagramProps {
	posts: BeholdPost[];
}

export default function HomeInstagram({ posts }: HomeInstagramProps) {
	if (posts.length === 0) return null;

	return (
		<Box bg="onyx">
			<BackgroundImage src="/assets/backgrounds/pageheading.jpg" py="md" style={{ zIndex: 0 }} pos="relative">
				<Container size="xl" py="md" px={{ base: "lg", md: "xl" }}>
					<ScrollAnchor name="instagram" />
					<Stack>
						<SectionHeading text="Instagram" color="white" />
						<SimpleGrid cols={{ base: 1, md: 2 }}>
							{posts.map((post) => (
								<InstagramCard key={post.id} {...post} />
							))}
						</SimpleGrid>
					</Stack>
				</Container>
				<Overlay backgroundOpacity={0.98} color="var(--mantine-color-onyx-filled)" blur={2} zIndex={-1} />
			</BackgroundImage>
		</Box>
	);
}
