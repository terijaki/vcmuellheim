import { BackgroundImage, Box, Button, Center, Container, Overlay, Stack, Text } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { useGalleryImages } from "../../lib/hooks";
import ScrollAnchor from "./ScrollAnchor";

export default function HomeFotos() {
	const { data } = useGalleryImages({ limit: 4, format: "urls", shuffle: true });
	const firstImage = data?.pages?.flatMap((page) => page.images)[0];

	const backgroundImage = firstImage || "/assets/backgrounds/pageheading.jpg";

	return (
		<Box bg="blumine">
			<ScrollAnchor name="fotos" />
			<BackgroundImage src={backgroundImage} py="md" style={{ zIndex: 0 }} pos="relative">
				<Container size="xs" py="md" c="white" px={{ base: "lg", md: "xl" }}>
					<Stack>
						<Text>Eindrücke aus unserem Vereinsleben, von Spieltagen, Turnieren und unseren Mitgliedern findest du in unserer:</Text>
						<Center>
							<Button component={Link} to="/fotos">
								Fotogalerie
							</Button>
						</Center>
					</Stack>
				</Container>

				<Overlay backgroundOpacity={0.95} color="var(--mantine-color-onyx-filled)" blur={2} zIndex={-1} />
			</BackgroundImage>
		</Box>
	);
}
