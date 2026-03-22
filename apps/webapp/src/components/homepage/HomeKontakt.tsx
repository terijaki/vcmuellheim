import { Anchor, Box, Card, Center, Container, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import type { HTMLAttributeAnchorTarget } from "react";
import { FaArrowUpRightFromSquare, FaBus, FaEnvelope, FaFileExcel } from "react-icons/fa6";
import { useMembers } from "../../hooks/dataQueries";
import SectionHeading from "../layout/SectionHeading";
import ScrollAnchor from "./ScrollAnchor";

export default function HomeKontakt() {
	const { data: members } = useMembers();

	const treasurer = members?.items.find((member) => member.roleTitle?.includes("Kassier") || member.roleTitle?.includes("Schatzmeister:in"));
	const membershipManager = members?.items.find((member) => member.roleTitle?.includes("Mitgliederverwaltung"));

	return (
		<Center>
			<ScrollAnchor name="kontakt" />
			<Container size="xl" px={{ base: "lg", md: "xl" }} py="xl">
				<Stack gap="xl">
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
							<ContactItem title="Jugendschutz">
								<Text component="div" size="sm">
									<ContactRouteLink to="/jugendschutz" label="Hier" /> findest du alle Informationen zum Jugendschutz.
								</Text>
							</ContactItem>
							<ContactItem title="Probetraining">
								<Text component="div" size="sm">
									Melde dich bitte beim jeweiligen Trainer oder Ansprechperson der Mannschaft <ContactLink href="#mannschaften" label="siehe oben" />
								</Text>
							</ContactItem>
							<ContactItem title="Vereinsbeitritt">
								<Text component="div" size="sm">
									Hier gehts zur <ContactRouteLink to="/beitragsordnung" label="Beitragsordnung" /> und hier zum{" "}
									<ContactLink href="https://vcm.kurabu.com/de/join/" target="_blank" label="Anmeldeformular" icon={<FaArrowUpRightFromSquare />} /> auf unserer Verwaltungssoftware KURABU.
								</Text>
							</ContactItem>

							<ContactItem title="Branding">
								<Text component="div" size="sm">
									Farben und Logo Dateien findest du im <ContactRouteLink to="/brand" label="Brand Guide" />
								</Text>
							</ContactItem>

							<ContactItem title="Allgemeine Anfragen">
								<Text component="div" size="sm">
									Nutze gerne unseren Mailverteiler <ContactLink href={"mailto:info@vcmuellheim.de"} target={"_blank"} label="info@vcmuellheim.de" icon={<FaEnvelope />} />
								</Text>
							</ContactItem>
						</SimpleGrid>
					</Stack>
					<Stack gap="md">
						<SectionHeading text="Für Mitglieder" color="onyx" />
						<SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }} spacing="lg" verticalSpacing="lg">
							<ContactItem title="Mitgliedschaft">
								<Text component="div" size="sm">
									Deine Mitgliedschaft verwaltest du selbst in <ContactLink href="https://vcm.kurabu.com/de/login" target="_blank" label="KURABU" icon={<FaArrowUpRightFromSquare />} />. Bei Fragen
									melde dich bei {membershipManager?.name ? `${membershipManager.name} ` : ""}
									<ContactLink href="mailto:mitgliedschaft@vcmuellheim.de?subject=Volleyball Club Müllheim" target="_blank" label="mitgliedschaft@vcmuellheim.de" icon={<FaEnvelope />} />.
								</Text>
							</ContactItem>
							<ContactItem title="Beitragszahlung">
								<Text component="div" size="sm">
									Bei Fragen zu deinen Beiträgen melde dich bitte bei {treasurer?.name ? `${treasurer.name} ` : ""}
									<ContactLink href="mailto:kassier@vcmuellheim.de?subject=Volleyball Club Müllheim" target="_blank" label="kassier@vcmuellheim.de" icon={<FaEnvelope />} />
								</Text>
							</ContactItem>
							<ContactItem title="Spesenabrechnung">
								<Text component="div" size="sm">
									Hier findest du die <ContactLink href="/docs/spesenabrechnung.xlsx" label="Spesenabrechnung" icon={<FaFileExcel />} /> und{" "}
									<ContactLink href="/docs/trainerverguetung.xlsx" label="Trainervergütung" icon={<FaFileExcel />} />
								</Text>
							</ContactItem>
							<ContactItem title="Vereinsbus">
								<Text component="div" size="sm">
									Hier findest du die <ContactLink href="/bus" label="Busverfügbarkeit" icon={<FaBus />} />
								</Text>
							</ContactItem>
						</SimpleGrid>
					</Stack>
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

function ContactRouteLink({ to, label }: { to: "/jugendschutz" | "/beitragsordnung" | "/brand"; label: string }) {
	return (
		<Anchor component={Link} to={to} display="inline-block" underline="never">
			<Group gap={4} align="baseline">
				<Text>{label}</Text>
			</Group>
		</Anchor>
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
