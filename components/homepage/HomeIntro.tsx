import { navbarLinks } from "@/utils/navbarLinks";
import { BackgroundImage, Box, Button, Container, Group, Image, Overlay, Stack, Text } from "@mantine/core";
import { unstable_cacheLife as cacheLife } from "next/cache";
import Link from "next/link";
import { FaAnglesDown as IconDown } from "react-icons/fa6";

const backgroundImages = [
	"/images/backgrounds/intro1.jpg",
	"/images/backgrounds/intro2.jpg",
	"/images/backgrounds/intro3.jpg",
	"/images/backgrounds/intro4.jpg",
];

export default async function HomeIntro() {
	"use cache";
	cacheLife("hours");

	const backgroundImageRandom = backgroundImages[Math.floor(Math.random() * backgroundImages.length)];
	if (!backgroundImageRandom) return null;
	return (
		<Box bg="oynx" c="white">
			<BackgroundImage src={backgroundImageRandom} style={{ zIndex: 0 }} pos="relative">
				<Stack gap="xl" align="center" justify="space-between" mih="70vh" p="xl">
					<Stack gap={0} align="center">
						<Text fw="bolder" size="xl" mt="xl">
							Willkommen beim
						</Text>
						<Image
							fit="contain"
							w={{ base: "100%", xs: "80%", sm: "70%", md: "60%", lg: "50%" }}
							mah="40vh"
							src="/images/logo/logo-weiss.png"
							alt="Vereinslogo"
						/>
					</Stack>
					<Container size="xs" pt="xl" mt="xl" hiddenFrom="sm">
						<Group gap="xs" justify="center">
							{navbarLinks.map((link) => {
								return (
									<Button
										key={link.name}
										component={Link}
										{...link}
										bg="onyx"
										radius="xl"
										bd="1px white solid"
										c="white"
									>
										{link.name}
									</Button>
								);
							})}
						</Group>
					</Container>
				</Stack>

				<IconDown
					style={{
						position: "absolute",
						right: "1.25rem",
						bottom: "1.25rem",
						fontSize: "1.5rem",
						animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
						opacity: 0,
					}}
				/>

				<Overlay backgroundOpacity={0.8} color="var(--mantine-color-onyx-filled)" blur={1} zIndex={-1} />
			</BackgroundImage>
		</Box>
	);
}
