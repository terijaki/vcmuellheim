import CardTitle from "@/components/CardTitle";
import PageWithHeading from "@/components/layout/PageWithHeading";
import { Button, Card, Group, Text } from "@mantine/core";
import { Metadata, ResolvingMetadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FaUser as IconAvatar, FaFilePdf as IconPdf } from "react-icons/fa6";


// generate a custom title
export async function generateMetadata({}, parent: ResolvingMetadata): Promise<Metadata | void> {
	return {
		title: "Jugendschutz",
	};
}

// contact people for this event
const people = [
	{ name: "Susanne Kainer", email: "susanne@vcmuellheim.de", role: "Jugendschutzbeauftragte", phone: "015201809406", picture: "/images/members/susannekainer.jpg" },
	{ name: "Claudio Czak-Lindemann", email: "claudio@vcmuellheim.de", role: "Jugendschutzbeauftragter", phone: "01781659793", picture: "/images/members/claudiolindemannczak.jpg" },
];

export default function Jugenschutz() {

// TODO read members from data base instead of defining them here
// TODO include their phone numbers

	return (
		<PageWithHeading title="Jugenschutz" >

			<Card>
				<Text>Der Volleyballclub Müllheim e.V. legt besonderen Wert auf das Wohl der Kinder und Jugendlichen in unserer Jugendarbeit. Unser Kinderschutzkonzept wird kontinuierlich unter Einbeziehung aller Beteiligten weiterentwickelt. Alle Trainer und Betreuer des Vereins verpflichten sich durch die Unterzeichnung eines Ehrenkodexes, die gemeinsam erarbeiteten Richtlinien zum Jugendschutz in ihrer Tätigkeit umzusetzen.</Text>
				<Text>Der Vorstand hat mit Susanne Kainer und Claudio Czak-Lindemann erfahrene und kompetente Personen gewonnen, die als Ansprechpartnerinnen zur Verfügung stehen und die Umsetzung sowie Weiterentwicklung des Konzepts vorantreiben werden. Der Vorstand des VC Müllheim unterstützt sie dabei aktiv und stellt ihnen alle notwendigen Ressourcen zur Verfügung.</Text>
				<CardTitle>Ehrenkodex</CardTitle>
				<Text>Alle Personen, die regelmäßig mit unseren Kindern und Jugendlichen in Kontakt stehen, verpflichten sich schriftlich, dem der unserer Kinder und Jugendlichen höchste Priorität einzuräumen.</Text>
				<CardTitle>Notfallpläne</CardTitle>
				<Text>Allen Betreuern und Trainern wird ein Notfallplan zur Verfügung gestellt.</Text>
				<CardTitle>Führungszeugnis</CardTitle>
				<Text>Alle Betreuer und Trainer müssen in regelmäßigen Abständen ein aktuelles Führungszeugnis einholen und vorzeigen.</Text>
				<CardTitle>Jugendschutzbeauftragte</CardTitle>
				<Text>Die Jugendschutzbeauftragten sorgen dafür, dass betroffene Personen eine direkte Ansprechperson haben, die bei Bedarf den Kontakt zu professionellen Beratungsstellen herstellen kann. Zudem stehen sie Trainerinnen, Trainern sowie Betreuerinnen und Betreuern als erste Anlaufstelle für Fragen und Unterstützung zur Verfügung. Der Schutz des Kindeswohls im Sport ist ein zentrales Qualitätsmerkmal unseres Vereins und stärkt das Vertrauen der Eltern in unsere Arbeit.</Text>
				<Group gap="xl">
					{people.map((person) => (
						<ContactCard
							key={person.name}
							{...person}
						/>
					))}
				</Group>
				<Text>Betroffene Personen oder Personen die einen Verdachtsfall beobachtet haben, können sich mit folgenden Kontaktdaten an uns wenden:</Text>
				<CardTitle>Kontakt</CardTitle>
				<Text>Niemand sollte sich im Kontakt mit anderen unwohl, bedroht oder belästigt fühlen. Wenn du eine solche Erfahrung machst oder bereits Übergriffe erlebt hast, stehen wir an deiner Seite – zögere nicht, uns zu kontaktieren!</Text>
				<Text>Wir nehmen dich mit allen Beschwerden und Verdachtsäußerungen ernst, bieten Unterstützung und Hilfen an! Auch wenn du zunächst Fragen hast, dir aber nicht sicher bist, ob du etwas unternehmen willst, darfst du uns jederzeit kontaktieren. Deine Vertraulichkeit steht für uns an oberster Stelle!</Text>
				<CardTitle>Dateien</CardTitle>

					<Button component={Link}
						href="/docs/ehrenkodex.pdf"
						download={true}
						prefetch={false}
						leftSection={<IconPdf  />}
					>
						Ehrenkodex
					</Button>

			</Card>
		</PageWithHeading>
	);
}

function ContactCard(props: { name?: string; email?: string; phone?: string; picture?: string; role?: string }) {
	if (!props.name) return null;

	return (
		<div className="flex flex-col shrink-0 rounded-2xl shadow overflow-hidden text-sm sm:text-base select-none">
			<div className="flex flex-row flex-nowrap place-items-center justify-items-start">
				<div className="w-24 h-24 aspect-square bg-lion *:h-full *:w-full">
					{props.picture ? (
						<Image
							width={96}
							height={96}
							src={props.picture}
							alt={props.name}
							style={{ objectFit: "cover" }}
						/>
					) : (
						<IconAvatar/>
					)}
				</div>
				<div className="grow p-3">
					<div className="font-bold">{props.name}</div>
					{props.email && (
						<Link
							href={"mailto:" + props.email}
							className="block text-sm"
						>
							{props.email}
						</Link>
					)}
					{props.phone && (
						<Link
							href={"tel:" + props.phone}
							className="block text-sm"
						>
							{props.phone}
						</Link>
					)}
				</div>
			</div>
			<div className="bg-blumine text-white w-full h-full hyphens-auto text-xs text-center basis-full">{props.role}</div>
		</div>
	);
}
