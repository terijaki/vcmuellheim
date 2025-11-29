import { BackgroundImage, Box, Button, Center, Container, Overlay, Stack, Text } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { useFileUrl, useGalleryImages } from "../../lib/hooks";
import ScrollAnchor from "./ScrollAnchor";

export default function HomeFotos() {
	const { data } = useGalleryImages({ limit: 10 });
	const firstImageKey = data?.pages?.[0]?.imageS3Keys?.[0];
	const { data: firstImageUrl } = useFileUrl(firstImageKey);

	const backgroundImage = firstImageUrl || "/images/backgrounds/pageheading.jpg";

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
