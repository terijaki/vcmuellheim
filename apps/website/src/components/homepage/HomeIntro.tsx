import { BackgroundImage, Button, Container, Group, Overlay, Stack, Text } from "@mantine/core";
import { useViewportSize } from "@mantine/hooks";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { FaAnglesDown as IconDown } from "react-icons/fa6";
import { navbarLinks } from "../../utils/navbarLinks";
import { HEADER_HEIGHT } from "../layout/Header";
import HomeIntroLogo from "./HomeIntroLogo";

const backgroundImages = ["/assets/backgrounds/intro1.jpg", "/assets/backgrounds/intro2.jpg", "/assets/backgrounds/intro3.jpg", "/assets/backgrounds/intro4.jpg"];

export default function HomeIntro() {
	const backgroundImageRandom = useMemo(() => {
		return backgroundImages[Math.floor(Math.random() * backgroundImages.length)];
	}, []);
	const { height, width } = useViewportSize();
	const isPortrait = height > width;
	const isMobile = width < 768;
	const HEIGHT = `calc(90vh - ${HEADER_HEIGHT}px)`;
	return (
		<BackgroundImage src={backgroundImageRandom} component={Stack} gap="xl" align="stretch" justify="space-between" mih={HEIGHT} p="xl" c="white" pos="relative">
			<Stack gap={0} align="center" style={{ position: "relative", zIndex: 2 }}>
				<Text fw="bolder" size="xl" mt="xl">
					Willkommen beim
				</Text>
				<HomeIntroLogo />
			</Stack>
			{(isPortrait || isMobile) && (
				<Container size="xs" pt="xl" mt="xl" style={{ zIndex: 2 }}>
					<Group gap="xs" justify="center">
						{navbarLinks.map((link) => {
							return (
								<Button key={link.name} component={Link} {...link} bg="onyx" radius="xl" bd="1px white solid" c="white">
									{link.name}
								</Button>
							);
						})}
					</Group>
				</Container>
			)}

			<IconDown
				style={{
					position: "absolute",
					right: "1.25rem",
					bottom: "1.25rem",
					fontSize: "1.5rem",
					animation: "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
					opacity: 0.4,
					zIndex: 3,
				}}
			/>

			<Overlay backgroundOpacity={0.8} color="var(--mantine-color-onyx-filled)" blur={1} zIndex={0} />
		</BackgroundImage>
	);
}
