import SectionHeading from "@/components/layout/SectionHeading";
import { Anchor, Center, Container, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import {
	FaEnvelope as IconEmail,
	FaFileExcel as IconExcel,
	FaArrowUpRightFromSquare as IconExtern,
} from "react-icons/fa6";
import ScrollAnchor from "./ScrollAnchor";

export default function HomeKontakt() {
	return (
		<Container size="xl" mx={{ base: undefined, xs: "xl" }}>
			<ScrollAnchor name="kontakt" />
			<Stack>
				<Stack gap={0}>
					<SectionHeading text="Kontakt" color="onyx" />
					<Center>
						<Text size="sm" c="dimmed">
							Zögere bitte nicht. Solltest du Fragen an uns haben, oder Interesse mit uns zu trainieren, dann melde dich
							bei uns!
						</Text>
					</Center>
				</Stack>
				<SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }} spacing="lg" verticalSpacing="lg">
					<ContactItem title="Hast du Interesse an einem Probetrainung?">
						<>
							Melde dich bitte beim jeweiligen Trainer oder Ansprechperson der Mannschaft{" "}
							<Anchor href="#mannschaften">siehe oben</Anchor>
						</>
					</ContactItem>
					<ContactItem title="Möchtest du dem Verein beitreten?">
						<>
							Hier gehts zur <Anchor href="/beitragsordnung/">Beitragsordnung</Anchor> und hier zum{" "}
							<Anchor href="https://vcm.kurabu.com/de/join/" target="_blank">
								<IconExtern className="inline-block whitespace-nowrap" /> Anmeldeformular
							</Anchor>{" "}
							auf unserer Verwaltungssoftware KURABU.
						</>
					</ContactItem>
					<ContactItem title="Hast du Fragen zu deiner Mitgliedschaft?">
						<>
							Melde dich bitte direkt bei Paul Morawietz{" "}
							<Anchor href="mailto:mitgliedschaft@vcmuellheim.de?subject=Volleyball Club Müllheim" target="_blank">
								<IconEmail className="inline-block whitespace-nowrap" /> mitgliedschaft@vcmuellheim.de
							</Anchor>
						</>
					</ContactItem>
					<ContactItem title="Hast du Fragen zu deiner Beitragszahlung?">
						<>
							Melde dich bitte direkt bei Peter Müssig{" "}
							<Anchor href="mailto:kassier@vcmuellheim.de?subject=Volleyball Club Müllheim" target="_blank">
								<IconEmail className="inline-block" /> kassier@vcmuellheim.de
							</Anchor>
						</>
					</ContactItem>
					<ContactItem title="Möchtest du Spesen abrechnen?">
						<>
							Hier findest du die{" "}
							<Anchor href="https://vcmuellheim.de/docs/spesenabrechnung.xlsx">
								<IconExcel className="inline-block" /> Spesenabrechnung
							</Anchor>{" "}
							und{" "}
							<Anchor href="https://vcmuellheim.de/docs/trainerverguetung.xlsx">
								<IconExcel className="inline-block" /> Trainervergütung
							</Anchor>
						</>
					</ContactItem>
					<ContactItem title="Hast du Fragen zu unserem Branding?">
						<>
							Farben und Logo Dateien findest du im <Anchor href="/brand">Brand Guide</Anchor>
						</>
					</ContactItem>
					<ContactItem title="Für alle weiteren Anliegen:">
						<Text>
							Nutze gerne unseren Mailverteiler{" "}
							<Anchor href="mailto:info@vcmuellheim.de" target="_blank">
								<IconEmail className="inline-block" /> info@vcmuellheim.de
							</Anchor>
						</Text>
					</ContactItem>
				</SimpleGrid>
			</Stack>
		</Container>
	);
}

function ContactItem({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<Stack gap={0}>
			<Title order={6}>{title}</Title>
			<Text size="sm">{children}</Text>
		</Stack>
	);
}
