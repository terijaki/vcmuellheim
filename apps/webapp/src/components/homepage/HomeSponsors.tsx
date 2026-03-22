import type { Sponsor } from "@lib/db/types";
import { Anchor, BackgroundImage, Box, Button, Container, Flex, Group, Image, Loader, Overlay, Stack, Text } from "@mantine/core";
import { Club } from "@project.config";
import { useFileUrl, useSponsors } from "../../hooks/dataQueries";
import SectionHeading from "../layout/SectionHeading";
import ScrollAnchor from "./ScrollAnchor";

//TODO when there are more sponsors (>2) use a Marquee (available in Mantine V9)

export default function HomeSponsors() {
	const { data } = useSponsors();
	const sponsors = data?.items || [];
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

function Sponsors({ sponsors }: { sponsors: Sponsor[] }) {
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

	return (
		<Stack align="center">
			<Text>Wir bedanken uns herzlich bei {sponsors.length === 1 ? "unserem Sponsor" : "unseren Sponsoren"}!</Text>
			<Group gap="xl" align="flex-start" justify="center">
				{sponsors.map((sponsor) => {
					return <SponsorCard sponsor={sponsor} key={sponsor.id} />;
				})}
			</Group>
		</Stack>
	);
}

function SponsorCard({ sponsor }: { sponsor: Sponsor }) {
	const { name, description, logoS3Key, websiteUrl } = sponsor;
	const { data: logoUrl, isLoading } = useFileUrl(logoS3Key);

	if (!name) return null;

	if (isLoading) {
		return (
			<Stack w={220} maw={"50vw"} gap={6} align="center">
				<Flex w={180} h={80} align="center" justify="center">
					<Loader color="white" />
				</Flex>
			</Stack>
		);
	}

	const visual = (
		<Flex w={180} h={80} maw={"50vw"} align="center" justify="center">
			{logoUrl ? (
				<Image src={logoUrl} alt={`${name}`} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
			) : (
				<Text size="xl" c="white" fw="bolder" ta="center">
					{name}
				</Text>
			)}
		</Flex>
	);

	const content = (
		<Stack w={220} maw={"50vw"} gap={6} align="center" justify="flex-start">
			{visual}
			{description ? (
				<Text size="sm" c="white" maw={220} ta="center" style={{ textWrap: "balance" }} lineClamp={2}>
					{description}
				</Text>
			) : null}
		</Stack>
	);

	if (websiteUrl) {
		return (
			<Anchor href={websiteUrl} target="_blank" rel="noopener noreferrer" c="inherit" underline="never" display="block">
				{content}
			</Anchor>
		);
	}

	return content;
}
