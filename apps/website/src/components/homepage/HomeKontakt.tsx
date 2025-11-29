import { Anchor, Box, Card, Center, Container, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import type { HTMLAttributeAnchorTarget } from "react";
import { FaEnvelope as IconEmail, FaFileExcel as IconExcel, FaArrowUpRightFromSquare as IconExtern } from "react-icons/fa6";
import { useMembers } from "../../lib/hooks";
import SectionHeading from "../layout/SectionHeading";
import ScrollAnchor from "./ScrollAnchor";

export default function HomeKontakt() {
	const { data: members } = useMembers();

	const treasurer = members?.items.find((member) => member.roleTitle?.includes("Kassier") || member.roleTitle?.includes("Schatzmeister:in"));
	const membershipManager = members?.items.find((member) => member.roleTitle?.includes("Mitgliederverwaltung"));

	return (
		<Center>
			<Container size="xl" px={{ base: "lg", md: "xl" }} py="xl">
				<ScrollAnchor name="kontakt" />
				<Stack gap="xl">
					<Stack gap={0}>
						<SectionHeading text="Kontakt" color="onyx" />
						<Center>
							<Text component="div" size="sm" c="dimmed">
								Zögere bitte nicht. Solltest du Fragen an uns haben, oder Interesse mit uns zu trainieren, dann melde dich bei uns!
							</Text>
						</Center>
					</Stack>
					<SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }} spacing="lg" verticalSpacing="lg">
						<ContactItem title="Hast du Interesse an einem Probetrainung?">
							<Text component="div" size="sm">
								Melde dich bitte beim jeweiligen Trainer oder Ansprechperson der Mannschaft <ContactLink href="#mannschaften" label="siehe oben" />
							</Text>
						</ContactItem>
						<ContactItem title="Hast du Fragen zu unserem Branding?">
							<Text component="div" size="sm">
								Farben und Logo Dateien findest du im <ContactLink href="/brand" label="Brand Guide" />
							</Text>
						</ContactItem>
						<ContactItem title="Möchtest du dem Verein beitreten?">
							<Text component="div" size="sm">
								Hier gehts zur <ContactLink href="/beitragsordnung/" label="Beitragsordnung" /> und hier zum{" "}
								<ContactLink href="https://vcm.kurabu.com/de/join/" target="_blank" label="Anmeldeformular" icon={<IconExtern />} /> auf unserer Verwaltungssoftware KURABU.
							</Text>
						</ContactItem>
						<ContactItem title="Hast du Fragen zu deiner Mitgliedschaft?">
							<Text component="div" size="sm">
								Melde dich bitte direkt bei {membershipManager?.name}{" "}
								<ContactLink href="mailto:mitgliedschaft@vcmuellheim.de?subject=Volleyball Club Müllheim" target="_blank" label="mitgliedschaft@vcmuellheim.de" icon={<IconEmail />} />
							</Text>
						</ContactItem>
						<ContactItem title="Hast du Fragen zu deiner Beitragszahlung?">
							<Text component="div" size="sm">
								Melde dich bitte direkt bei {treasurer?.name ? `${treasurer.name} ` : " "}
								<ContactLink href="mailto:kassier@vcmuellheim.de?subject=Volleyball Club Müllheim" target="_blank" label="kassier@vcmuellheim.de" icon={<IconEmail />} />
							</Text>
						</ContactItem>
						<ContactItem title="Möchtest du Spesen abrechnen?">
							<Text component="div" size="sm">
								Hier findest du die <ContactLink href="/docs/spesenabrechnung.xlsx" label="Spesenabrechnung" icon={<IconExcel />} /> und{" "}
								<ContactLink href="/docs/trainerverguetung.xlsx" label="Trainervergütung" icon={<IconExcel />} />
							</Text>
						</ContactItem>
						<ContactItem title="Für alle weiteren Anliegen:">
							<Text component="div" size="sm">
								Nutze gerne unseren Mailverteiler <ContactLink href={"mailto:info@vcmuellheim.de"} target={"_blank"} label="info@vcmuellheim.de" icon={<IconEmail />} />
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

function ContactLink({ href, target, label, icon }: { href: string; target?: HTMLAttributeAnchorTarget; label: string; icon?: React.ReactNode }) {
	return (
		<Anchor href={href} target={target} display="inline-block" underline="never">
			<Group gap={4} align="baseline">
				{icon}
				<Text>{label}</Text>
			</Group>
		</Anchor>
	);
}
