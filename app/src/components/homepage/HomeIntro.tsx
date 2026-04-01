import { BackgroundImage, Button, Container, Group, Overlay, Stack } from "@mantine/core";
import { useViewportSize } from "@mantine/hooks";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { FaAnglesDown as IconDown } from "react-icons/fa6";
import { navbarLinks } from "../../utils/navbarLinks";
import { HEADER_HEIGHT } from "../layout/Header";

interface HomeIntroProps {
	backgroundImage: string;
	introContent: ReactNode;
}

export default function HomeIntro({ backgroundImage, introContent }: HomeIntroProps) {
	const { height, width } = useViewportSize();
	const isPortrait = height > width;
	const isMobile = width < 768;
	const HEIGHT = `calc(90vh - ${HEADER_HEIGHT}px)`;
	return (
		<BackgroundImage src={backgroundImage} component={Stack} gap="xl" align="stretch" justify="space-between" mih={HEIGHT} py="xl" px="sm" c="white" pos="relative">
			{introContent}
			{(isPortrait || isMobile) && (
				<Container size="xs" pt="xl" mt="xl" style={{ zIndex: 2 }}>
					<Group gap="xs" justify="center">
						{navbarLinks.map((link) => {
							return (
								<Button
									key={link.name}
									bg="onyx"
									radius="xl"
									bd="1px white solid"
									c="white"
									renderRoot={(props) => {
										if (link.href.includes("https://")) {
											return <a {...props} {...link} />;
										}
										return <Link {...props} {...link} />;
									}}
								>
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
