import { BackgroundImage, Box, Button, Container, Flex, Group, Image, Overlay, Stack, Text } from "@mantine/core";
import Marquee from "react-fast-marquee";
import SectionHeading from "@/components/layout/SectionHeading";
import type { Sponsor } from "@/data/payload-types";
import { getSponsors } from "@/data/sponsors";
import { Club } from "@/project.config";
import ScrollAnchor from "./ScrollAnchor";

export default async function HomeSponsors() {
	const data = await getSponsors();
	let sponsors = data?.docs || [];
	if (sponsors.length === 0) return null;

	sponsors = [];

	return (
		<Box bg="blumine">
			<ScrollAnchor name="sponsors" />
			<BackgroundImage src="/images/backgrounds/sponsors.jpg" py="md" style={{ zIndex: 0 }} pos="relative">
				<Container size="xl" py="md" c="white">
					<Stack gap="xs">
						<SectionHeading text={sponsors.length === 0 ? "Sponsoring" : sponsors.length === 1 ? "Sponsor" : "Sponsoren"} color="white" />
						<Sponsors sponsors={sponsors} />
					</Stack>
				</Container>

				<Overlay backgroundOpacity={0.9} color="var(--mantine-color-blumine-filled)" blur={2} zIndex={-1} />
			</BackgroundImage>
		</Box>
	);
}

async function Sponsors({ sponsors }: { sponsors: Sponsor[] }) {
	if (!sponsors || sponsors.length === 0)
		return (
			<Container size="sm">
				<Stack justify="center" align="center">
					<Text style={{ textWrap: "balance" }}>
						Um möglichst viele gemeinnützige Aktivitäten für alle Altersbereiche durchführen zu können, suchen wir Sponsoring Partnerschaften. Informieren Sie sich über unsere Werbemöglichkeiten.
					</Text>
					<Box>
						<Button component="a" href={`mailto:philipp@vcmuellheim.de?subject=Sponsoring ${Club.shortName}`} variant="white">
							Förderverein kontaktieren
						</Button>
					</Box>
				</Stack>
			</Container>
		);

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
			<Flex w={180} h={80} maw={"50vw"} align="center" justify="center">
				<Image src={logoUrl} alt={`${name}`} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
			</Flex>
		);

	if (website && name)
		return (
			<Flex component="a" href={website} target="_blank" rel="noopener noreferrer" w={180} h={80} maw={"50vw"} align="center" justify="center">
				{logoUrl ? (
					<Image src={logoUrl} alt={`${name}`} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
				) : (
					<Text size="xl" c="white" fw="bolder">
						{name}
					</Text>
				)}
			</Flex>
		);
}
