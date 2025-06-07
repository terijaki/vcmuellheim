import SectionHeading from "@/components/layout/SectionHeading";
import { getMembersByRole } from "@/data/members";
import { Anchor, Box, Card, Center, Container, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import type { HTMLAttributeAnchorTarget } from "react";
import {
	FaEnvelope as IconEmail,
	FaFileExcel as IconExcel,
	FaArrowUpRightFromSquare as IconExtern,
} from "react-icons/fa6";
import ScrollAnchor from "./ScrollAnchor";

export default async function HomeKontakt() {
	const treasurerData = await getMembersByRole(["Kassier", "Schatzmeister:in"]);
	const treasurer = treasurerData?.docs[0];
	const membershipManagerData = await getMembersByRole(["Mitgliederverwaltung"]);
	const membershipManager = membershipManagerData?.docs[0];

	return (
		<Center>
			<Container size="xl" px={{ base: "lg", md: "xl" }} py="xl">
				<ScrollAnchor name="kontakt" />
				<Stack gap="xl">
					<Stack gap={0}>
						<SectionHeading text="Kontakt" color="onyx" />
						<Center>
							<Text size="sm" c="dimmed">
								Zögere bitte nicht. Solltest du Fragen an uns haben, oder Interesse mit uns zu trainieren, dann melde
								dich bei uns!
							</Text>
						</Center>
					</Stack>
					<SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }} spacing="lg" verticalSpacing="lg">
						<ContactItem title="Hast du Interesse an einem Probetrainung?">
							<Text size="sm">
								Melde dich bitte beim jeweiligen Trainer oder Ansprechperson der Mannschaft{" "}
								<ContactLink href="#mannschaften" label="siehe oben" />
							</Text>
						</ContactItem>
						<ContactItem title="Hast du Fragen zu unserem Branding?">
							<Text size="sm">
								Farben und Logo Dateien findest du im <ContactLink href="/brand" label="Brand Guide" />
							</Text>
						</ContactItem>
						<ContactItem title="Möchtest du dem Verein beitreten?">
							<Text size="sm">
								Hier gehts zur <ContactLink href="/beitragsordnung/" label="Beitragsordnung" /> und hier zum{" "}
								<ContactLink
									href="https://vcm.kurabu.com/de/join/"
									target="_blank"
									label="Anmeldeformular"
									icon={<IconExtern />}
								/>{" "}
								auf unserer Verwaltungssoftware KURABU.
							</Text>
						</ContactItem>
						<ContactItem title="Hast du Fragen zu deiner Mitgliedschaft?">
							<Text size="sm">
								Melde dich bitte direkt bei {membershipManager?.name}{" "}
								<ContactLink
									href="mailto:mitgliedschaft@vcmuellheim.de?subject=Volleyball Club Müllheim"
									target="_blank"
									label="mitgliedschaft@vcmuellheim.de"
									icon={<IconEmail />}
								/>
							</Text>
						</ContactItem>
						<ContactItem title="Hast du Fragen zu deiner Beitragszahlung?">
							<Text size="sm">
								Melde dich bitte direkt bei {treasurer?.name}{" "}
								<ContactLink
									href="mailto:kassier@vcmuellheim.de?subject=Volleyball Club Müllheim"
									target="_blank"
									label="kassier@vcmuellheim.de"
									icon={<IconEmail />}
								/>
							</Text>
						</ContactItem>
						<ContactItem title="Möchtest du Spesen abrechnen?">
							<Text size="sm">
								Hier findest du die{" "}
								<ContactLink
									href="https://vcmuellheim.de/docs/spesenabrechnung.xlsx"
									label="Spesenabrechnung"
									icon={<IconExcel />}
								/>{" "}
								und{" "}
								<ContactLink
									href="https://vcmuellheim.de/docs/trainerverguetung.xlsx"
									label="Trainervergütung"
									icon={<IconExcel />}
								/>
							</Text>
						</ContactItem>
						<ContactItem title="Für alle weiteren Anliegen:">
							<Text size="sm">
								Nutze gerne unseren Mailverteiler{" "}
								<ContactLink
									href={"mailto:info@vcmuellheim.de"}
									target={"_blank"}
									label="info@vcmuellheim.de"
									icon={<IconEmail />}
								/>
							</Text>
						</ContactItem>
					</SimpleGrid>
				</Stack>
			</Container>
		</Center>
	);
}

function ContactItem({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<Card>
			<Stack gap={0}>
				<Title order={5}>{title}</Title>
				<Box>{children}</Box>
			</Stack>
		</Card>
	);
}

function ContactLink({
	href,
	target,
	label,
	icon,
}: { href: string; target?: HTMLAttributeAnchorTarget; label: string; icon?: React.ReactNode }) {
	return (
		<Anchor href={href} target={target} display="inline-block" underline="never">
			<Group gap={4} align="baseline">
				{icon}
				<Text>{label}</Text>
			</Group>
		</Anchor>
	);
}
