import SectionHeading from "@/components/layout/SectionHeading";
import type { Sponsor } from "@/data/payload-types";
import { getSponsors } from "@/data/sponsors";
import { BackgroundImage, Box, Container, Group, Overlay, Stack, Text } from "@mantine/core";
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
					{sponsors.map((sponsor) => {
						if (sponsor.name && sponsor.logo) {
							return (
								<div key={sponsor.name} className="h-20 w-36 mx-6">
									<SponsorCard {...sponsor} />
								</div>
							);
						}
						if (sponsor.name) {
							return (
								<div
									key={sponsor.name}
									className="flex justify-center items-center text-center font-bold text-2xl md:text-4xl lg:text-5xl text-balance font-industrial"
								>
									{sponsor.name}
								</div>
							);
						}
					})}
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

	if (!logoUrl) return null;

	return (
		<Box component={website ? Link : undefined} href={website || ""} w={180} h={80} maw={"50vw"} pos="relative">
			<Image fill loading="lazy" src={logoUrl} objectFit="contain" alt={`${name}`} />
		</Box>
	);
}
