import { getPictures } from "@/data/pictures";
import { BackgroundImage, Box, Button, Center, Container, Overlay, Stack, Text } from "@mantine/core";
import Link from "next/link";
import ScrollAnchor from "./ScrollAnchor";

export default async function HomeFotos() {
	const data = await getPictures(5);
	const pictures = data?.docs;

	return (
		<Box bg="blumine">
			<ScrollAnchor name="fotos" />
			<BackgroundImage
				src={pictures?.[0]?.url || "/images/backgrounds/pageheading.jpg"}
				py="md"
				style={{ zIndex: 0 }}
				pos="relative"
			>
				<Container size="xs" py="md" c="white">
					<Stack>
						<Text>
							Eindrücke aus unserem Vereinsleben, von Spieltagen, Turnieren und unseren Mitgliedern findest du in
							unserer:
						</Text>
						<Center>
							<Button component={Link} href="/fotos">
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
