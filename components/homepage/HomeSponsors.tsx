import SectionHeading from "@/components/layout/SectionHeading";
import type { Sponsor } from "@/data/payload-types";
import { getSponsors } from "@/data/sponsors";
import { BackgroundImage, Box, Container, Flex, Group, Overlay, Stack, Text } from "@mantine/core";
import Image from "next/image";
import Link from "next/link";
import Marquee from "react-fast-marquee";
import ScrollAnchor from "./ScrollAnchor";

export default async function HomeSponsors() {
	const data = await getSponsors();
	if (!data) return null;
	const sponsors = data.docs;
	if (sponsors.length === 0) return null;

	return (
		<Box bg="blumine">
			<ScrollAnchor name="sponsors" />
			<BackgroundImage src="/images/backgrounds/sponsors.jpg" py="md" style={{ zIndex: 0 }} pos="relative">
				<Container size="xl" py="md" c="white">
					<Stack gap="xs">
						<SectionHeading text={sponsors.length === 1 ? "Sponsor" : "Sponsoren"} color="white" />
						<Sponsors sponsors={sponsors} />
					</Stack>
				</Container>

				<Overlay backgroundOpacity={0.9} color="var(--mantine-color-blumine-filled)" blur={2} zIndex={-1} />
			</BackgroundImage>
		</Box>
	);
}

async function Sponsors({ sponsors }: { sponsors: Sponsor[] }) {
	if (sponsors.length > 3) {
		return (
			<Stack align="center">
				<Text>Wir bedanken uns herzlich bei unseren Sponsoren!</Text>
				<Marquee pauseOnHover={true} speed={5}>
					{sponsors.map((sponsor) => (
						<SponsorCard {...sponsor} key={sponsor.name} />
					))}
				</Marquee>
			</Stack>
		);
	}
	return (
		<Stack align="center">
			<Text>Wir bedanken uns herzlich bei {sponsors.length === 1 ? " unserem Sponsor" : "unseren Sponsoren"}!</Text>
			<Group gap="xl">
				{sponsors.map((sponsor) => {
					return <SponsorCard {...sponsor} key={sponsor.name} />;
				})}
			</Group>
		</Stack>
	);
}

function SponsorCard({ name, logo, website }: Sponsor) {
	const logoUrl = logo && typeof logo === "object" ? logo.url : false;

	if (logoUrl && !website)
		return (
			<Flex w={180} h={80} maw={"50vw"} pos="relative" align="center" justify="center">
				<Image fill loading="lazy" src={logoUrl} alt={`${name}`} style={{ objectFit: "contain" }} />
			</Flex>
		);

	if (website && name)
		return (
			<Flex component={Link} href={website} w={180} h={80} maw={"50vw"} pos="relative" align="center" justify="center">
				{logoUrl ? (
					<Image fill loading="lazy" src={logoUrl} alt={`${name}`} style={{ objectFit: "contain" }} />
				) : (
					<Text size="xl" c="white" fw="bolder">
						{name}
					</Text>
				)}
			</Flex>
		);
}
