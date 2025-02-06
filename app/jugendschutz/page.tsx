import PageHeading from "@/app/components/layout/PageHeading";
import ExportedImage from "next-image-export-optimizer";
import Link from "next/link";
import { FaUser as IconAvatar, FaFilePdf as IconPdf } from "react-icons/fa6";

// generate a custom title
import { Metadata, ResolvingMetadata } from "next";
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
	return (
		<>
			<PageHeading title="Jugenschutz" />

			<div className="col-full-content sm:col-center-content my-6 card grid grid-flow-row prose-h2:font-bold prose-h2:text-blumine prose-h2:text-2xl gap-3 *:overflow-hidden">
				<p>Der Volleyballclub Müllheim e.V. legt besonderen Wert auf das Wohl der Kinder und Jugendlichen in unserer Jugendarbeit. Unser Kinderschutzkonzept wird kontinuierlich unter Einbeziehung aller Beteiligten weiterentwickelt. Alle Trainer und Betreuer des Vereins verpflichten sich durch die Unterzeichnung eines Ehrenkodexes, die gemeinsam erarbeiteten Richtlinien zum Jugendschutz in ihrer Tätigkeit umzusetzen.</p>
				<p>Der Vorstand hat mit Susanne Kainer und Claudio Czak-Lindemann erfahrene und kompetente Personen gewonnen, die als Ansprechpartnerinnen zur Verfügung stehen und die Umsetzung sowie Weiterentwicklung des Konzepts vorantreiben werden. Der Vorstand des VC Müllheim unterstützt sie dabei aktiv und stellt ihnen alle notwendigen Ressourcen zur Verfügung.</p>
				<h2>Ehrenkodex</h2>
				<p>Alle Personen, die regelmäßig mit unseren Kindern und Jugendlichen in Kontakt stehen, verpflichten sich schriftlich, dem der unserer Kinder und Jugendlichen höchste Priorität einzuräumen.</p>
				<h2>Notfallpläne</h2>
				<p>Allen Betreuern und Trainern wird ein Notfallplan zur Verfügung gestellt.</p>
				<h2>Führungszeugnis</h2>
				Alle Betreuer und Trainer müssen in regelmäßigen Abständen ein aktuelles Führungszeugnis einholen und vorzeigen.
				<h2>Jugendschutzbeauftragte</h2>
				<p>Die Jugendschutzbeauftragten sorgen dafür, dass betroffene Personen eine direkte Ansprechperson haben, die bei Bedarf den Kontakt zu professionellen Beratungsstellen herstellen kann. Zudem stehen sie Trainerinnen, Trainern sowie Betreuerinnen und Betreuern als erste Anlaufstelle für Fragen und Unterstützung zur Verfügung. Der Schutz des Kindeswohls im Sport ist ein zentrales Qualitätsmerkmal unseres Vereins und stärkt das Vertrauen der Eltern in unsere Arbeit.</p>
				<div className="flex flex-wrap grow-0 gap-x-8 gap-y-4 justify-center my-3">
					{people.map((person) => (
						<ContactCard
							key={person.name}
							{...person}
						/>
					))}
				</div>
				<p>Betroffene Personen oder Personen die einen Verdachtsfall beobachtet haben, können sich mit folgenden Kontaktdaten an uns wenden:</p>
				<h2>Kontakt</h2>
				<p>Niemand sollte sich im Kontakt mit anderen unwohl, bedroht oder belästigt fühlen. Wenn du eine solche Erfahrung machst oder bereits Übergriffe erlebt hast, stehen wir an deiner Seite – zögere nicht, uns zu kontaktieren!</p>
				<p>Wir nehmen dich mit allen Beschwerden und Verdachtsäußerungen ernst, bieten Unterstützung und Hilfen an! Auch wenn du zunächst Fragen hast, dir aber nicht sicher bist, ob du etwas unternehmen willst, darfst du uns jederzeit kontaktieren. Deine Vertraulichkeit steht für uns an oberster Stelle!</p>
				<h2>Dateien</h2>
				<div>
					<Link
						href="/docs/ehrenkodex.pdf"
						download={true}
						prefetch={false}
					>
						<IconPdf className="inline-block" /> Ehrenkodex
					</Link>
				</div>
			</div>
		</>
	);
}

function ContactCard(props: { name?: string; email?: string; phone?: string; picture?: string; role?: string }) {
	if (!props.name) return null;

	return (
		<div className="flex flex-col shrink-0 rounded-2xl shadow overflow-hidden text-sm sm:text-base select-none">
			<div className="flex flex-row flex-nowrap place-items-center justify-items-start">
				<div className="w-24 h-24 aspect-square bg-lion *:h-full *:w-full">
					{props.picture ? (
						<ExportedImage
							width={96}
							height={96}
							src={props.picture}
							alt={props.name}
							className="object-cover"
						/>
					) : (
						<IconAvatar className="text-white mt-3" />
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
