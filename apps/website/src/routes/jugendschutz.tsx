import { Box, Button, Card, Group, Stack, Text } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { FaFilePdf as IconPdf } from "react-icons/fa6";
import CardTitle from "../components/CardTitle";
import PageWithHeading from "../components/layout/PageWithHeading";
import MemberCard from "../components/MemberCard";
import { useMembers } from "../lib/hooks";

export const Route = createFileRoute("/jugendschutz")({
	component: RouteComponent,
});

function RouteComponent() {
	const { data } = useMembers();
	// Filter for members with roleTitle including 'Jugendschutz' (case-insensitive)
	const jugendschutzMembers = (data?.items || []).filter((member) => typeof member.roleTitle === "string" && member.roleTitle.toLowerCase().includes("jugendschutz"));

	return (
		<PageWithHeading title="Jugenschutz">
			<Card>
				<Stack>
					<Text>
						Der Volleyballclub Müllheim e.V. legt besonderen Wert auf das Wohl der Kinder und Jugendlichen in unserer Jugendarbeit. Unser Kinderschutzkonzept wird kontinuierlich unter Einbeziehung
						aller Beteiligten weiterentwickelt. Alle Trainer und Betreuer des Vereins verpflichten sich durch die Unterzeichnung eines Ehrenkodexes, die gemeinsam erarbeiteten Richtlinien zum
						Jugendschutz in ihrer Tätigkeit umzusetzen.
					</Text>
					<Text>
						Der Vorstand hat mit Susanne Kainer und Claudio Czak-Lindemann erfahrene und kompetente Personen gewonnen, die als Ansprechpartnerinnen zur Verfügung stehen und die Umsetzung sowie
						Weiterentwicklung des Konzepts vorantreiben werden. Der Vorstand des VC Müllheim unterstützt sie dabei aktiv und stellt ihnen alle notwendigen Ressourcen zur Verfügung.
					</Text>
					<Stack gap={0}>
						<CardTitle>Ehrenkodex</CardTitle>
						<Text>
							Alle Personen, die regelmäßig mit unseren Kindern und Jugendlichen in Kontakt stehen, verpflichten sich schriftlich, dem der unserer Kinder und Jugendlichen höchste Priorität
							einzuräumen.
						</Text>
					</Stack>
					<Stack gap={0}>
						<CardTitle>Notfallpläne</CardTitle>
						<Text>Allen Betreuern und Trainern wird ein Notfallplan zur Verfügung gestellt.</Text>
					</Stack>
					<Stack gap={0}>
						<CardTitle>Führungszeugnis</CardTitle>
						<Text>Alle Betreuer und Trainer müssen in regelmäßigen Abständen ein aktuelles Führungszeugnis einholen und vorzeigen.</Text>
					</Stack>
					<Stack gap={0}>
						<CardTitle>Jugendschutzbeauftragte</CardTitle>
						<Stack>
							<Text>
								Die Jugendschutzbeauftragten sorgen dafür, dass betroffene Personen eine direkte Ansprechperson haben, die bei Bedarf den Kontakt zu professionellen Beratungsstellen herstellen kann.
								Zudem stehen sie Trainerinnen, Trainern sowie Betreuerinnen und Betreuern als erste Anlaufstelle für Fragen und Unterstützung zur Verfügung. Der Schutz des Kindeswohls im Sport ist ein
								zentrales Qualitätsmerkmal unseres Vereins und stärkt das Vertrauen der Eltern in unsere Arbeit.
							</Text>
							<Group gap="xl">
								{jugendschutzMembers.map((member) => (
									<MemberCard key={member.id} member={member} show="phone" />
								))}
							</Group>
							<Text>Betroffene Personen oder Personen die einen Verdachtsfall beobachtet haben, können sich jederzeit an uns wenden.</Text>
						</Stack>
					</Stack>
					<Stack gap={0}>
						<CardTitle>Kontakt</CardTitle>
						<Text>
							Niemand sollte sich im Kontakt mit anderen unwohl, bedroht oder belästigt fühlen. Wenn du eine solche Erfahrung machst oder bereits Übergriffe erlebt hast, stehen wir an deiner Seite –
							zögere nicht, uns zu kontaktieren!
						</Text>
					</Stack>
					<Text>
						Wir nehmen dich mit allen Beschwerden und Verdachtsäußerungen ernst, bieten Unterstützung und Hilfen an! Auch wenn du zunächst Fragen hast, dir aber nicht sicher bist, ob du etwas
						unternehmen willst, darfst du uns jederzeit kontaktieren. Deine Vertraulichkeit steht für uns an oberster Stelle!
					</Text>
					<CardTitle>Dateien</CardTitle>
					<Box>
						<Button component="a" href="/docs/ehrenkodex.pdf" download={true} leftSection={<IconPdf />}>
							Ehrenkodex
						</Button>
					</Box>
				</Stack>
			</Card>
		</PageWithHeading>
	);
}
