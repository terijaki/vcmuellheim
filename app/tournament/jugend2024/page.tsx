import PageHeading from "@/app/components/layout/PageHeading";
import MembersCard from "@/app/components/ui/MemberCard";
import { shuffleArray } from "@/app/utils/shuffleArray";
import matter from "gray-matter";

// generate a custom title
import { Metadata, ResolvingMetadata } from "next";
import ExportedImage from "next-image-export-optimizer";
import Link from "next/link";
export async function generateMetadata({}, parent: ResolvingMetadata): Promise<Metadata | void> {
	return {
		title: "Jugendturnier 2024",
	};
}

// reference of past tournaments
const pastTournamentPosts = [
	["data/posts/2022-07-12-unser-1.jugendturnier-schlug-voll-ein.md", "Turnier 2022"],
	["data/posts/2023-06-21-Zweites-Internationales-Jugendturnier.md", "Turnier 2023"],
];

// contact people for this event
const people = [
	{ name: "Klaus Ernst", email: "klaus@vcmuellheim.de", role: "Organisator & Trainer", picture: "/images/members/klausernst.jpg" },
	{ name: "Dominik Ernst", email: "dominik@vcmuellheim.de", role: "Organisator & Trainer", picture: "/images/members/dominikernst.jpg" },
	{ name: "Björn Kohnen", email: "bjoern@vcmuellheim.de", role: "Vorstand", picture: "/images/members/bjoernkohnen.jpg" },
];

export default function JugendturnierPage() {
	let pastImages: string[] = [];
	pastTournamentPosts.forEach((event) => {
		const { data: frontmatter } = matter.read(event[0]);
		frontmatter.gallery.forEach((image: string) => pastImages.push(image));
	});
	const shuffledPastImages = shuffleArray(pastImages, 12);

	return (
		<>
			<PageHeading
				subtitle="Jugendturnier 2024"
				title="3. Markgräfler Taxi Cup"
			/>

			<div className="col-full-content sm:col-center-content my-6 card grid grid-flow-row prose-h2:font-bold prose-h2:text-blumine prose-h2:text-2xl gap-3 *:overflow-hidden">
				<h2>Sei dabei!</h2>
				<p>Der Volleyball Club Müllheim veranstaltet dieses Jahr erneut ein internationales Jugendturnier und du bist herzlich eingeladen!</p>
			</div>

			<div className="col-full-content sm:col-center-content my-6 card grid grid-flow-row prose-h2:font-bold prose-h2:text-blumine prose-h2:text-2xl gap-3 *:overflow-hidden">
				<h2>Wann geht es los?</h2>
				<p>
					Am Sonntag den <b>16.06.2024</b> um <b>11:00 Uhr</b> startet das Turnier.
					<br />
					Ab 10:15 Uhr wird die Halle geöffnet und ab 10:30 Uhr gibt es eine kurze Trainerbesprechung.
				</p>

				<h2>Wo ist das Turnier?</h2>
				<p>
					Das Turnier findet in der{" "}
					<Link
						href="https://goo.gl/maps/g3XhvCS9gpR2"
						target="_blank"
						className="text-blumine hover:text-turquoise underline underline-offset-2"
					>
						Sporthalle II, Schwarzwaldstraße 12A, 79379 Müllheim
					</Link>{" "}
					statt. Der Eingang befindet sich in einer Gasse der Bismarckstraße gegenüber des Hebel Parks.
				</p>
				<p>Die komplette Sporthalle (Abteil A-E) steht für das Volleyballturnier zur Verfügung.</p>

				<h2>Wie wird gespielt?</h2>
				<p>Das Turnier wird wie folgt aufgeteilt:</p>
				<ul className="list-inside list-disc">
					<li>U18 weiblich 6:6 (Jahrgänge 2008/2009)</li>
					<li>U16 weiblich 6:6 (Jahrgänge 2010/2011)</li>
					<li>U16 männlich 6:6 (Jahrgänge 2010/2011)</li>
				</ul>
				<p>Wir bemühen uns um geringe Wartezeiten für alle Spieler:innen.</p>

				<h2>Welche Kosten entstehen?</h2>
				<p>
					Dank unseres Sponsors (
					<Link
						href="https://www.mgl-taxi.de"
						target="_blank"
						className="text-blumine hover:text-turquoise underline underline-offset-2"
					>
						Markgräfler Taxi
					</Link>
					) erheben wir keine Anmeldegebühr und können die Unkosten für dieses Turnier decken. Spenden werden jedoch gerne angenommen und fließen in die Mannschaftskassen unserer Helfer:innen.
				</p>

				<h2>Was muss ich mitbringen?</h2>
				<p>
					Alle Teilnehmer:innen <span className="italic font-bold">müssen</span> Hallenschuhe tragen!
					<br />
					Wir bitten darum, Essen & Trinken selbst mitzubringen und Abfälle auch selbst wieder mitzunehmen. Kaffee, Kuchen und ein paar Kleinigkeiten werden auf Spendenbasis als Buffet angeboten.
				</p>

				<h2>Wie kann ich uns anmelden?</h2>
				<p>
					Für die Anmeldung nutze bitte folgendes Formular:{" "}
					<Link
						href="https://forms.gle/KofwhKyzq8BQ9PXs6"
						target="_blank"
						className="text-blumine hover:text-turquoise underline underline-offset-2"
					>
						https://forms.gle/KofwhKyzq8BQ9PXs6
					</Link>
					<br />
					Der Anmeldeschluss ist der <b>31.05.2024</b>.
				</p>
				<p>
					Sollten wir zu viele Anmeldungen erhalten, verteilen wir fair anhand der Anmeldezeiten und teilen zunächst 1 Mannschaft pro Verein ein. Meldet euch aber trotzdem gerne mit allen Mannschaften
					an, die teilnehmen möchten.
				</p>
			</div>

			<div className="col-full-content sm:col-center-content my-6 card grid grid-flow-row prose-h2:font-bold prose-h2:text-blumine prose-h2:text-2xl gap-3 *:overflow-hidden *:m-auto bg-black text-white">
				<ExportedImage
					src="images/sponsors/markgraefler_taxi.png"
					alt={""}
					width={570}
					height={213}
					className="rounded-md shadow"
				/>
				<p>
					<Link
						href="https://www.mgl-taxi.de"
						target="_blank"
						className="text-lion hover:text-turquoise underline underline-offset-2"
					>
						https://mgl-taxi.de
					</Link>
					<span className="mx-2 opacity-30">|</span>
					<Link
						href="tel:+4976315588"
						target="_blank"
						className="text-lion hover:text-turquoise underline underline-offset-2"
					>
						07631 55 88
					</Link>
				</p>
				<p>Markgräfler Taxi GmbH ist offizieller Sponser des diesjährigen internationalen Jugendturnier.</p>
			</div>

			<div className="col-full-content sm:col-center-content my-6 card grid grid-flow-row prose-h2:font-bold prose-h2:text-blumine prose-h2:text-2xl gap-3 *:overflow-hidden">
				<h2>Bilder aus den vergangenen Jahren</h2>
				<p className="opacity-70">zufällige Auswahl und Reihenfolge</p>
				<div className="gallery grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-3">
					{shuffledPastImages.map((image) => (
						<div
							className="relative w-auto h-auto aspect-video rounded-md overflow-hidden [&:nth-child(n+5)]:hidden sm:!block"
							key={image}
						>
							<Link
								href={image}
								target="_blank"
								className="group shadow-xs hover:cursor-zoom-in after:opacity-0 hover:after:opacity-100 after:absolute after:inset-0 after:h-full after:w-full after:pointer-events-none hover:after:z-10 after:border-4 after:border-dashed after:border-white after:duration-300"
							>
								<ExportedImage
									src={image}
									fill
									alt={""}
									className="object-cover group-hover:scale-105 transition-transform duration-700"
								/>
							</Link>
						</div>
					))}
				</div>
				<p>
					Weitere Bilder findet ihr in den jeweiligen Berichten:
					{pastTournamentPosts.map((post) => (
						<Link
							key={post[0]}
							href={post[0].replace("data/posts/", "../").replace(".md", "")}
							className="text-blumine hover:text-turquoise underline underline-offset-2 ml-2"
						>
							<span className="whitespace-nowrap">{post[1]}</span>
						</Link>
					))}
				</p>
			</div>

			<div className="col-full-content sm:col-center-content my-6 card grid grid-flow-row prose-h2:font-bold prose-h2:text-blumine prose-h2:text-2xl gap-3 *:overflow-hidden">
				<h2>Ansprechpersonen</h2>
				<div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(160px,min-content))] sm:grid-cols-[repeat(auto-fit,minmax(200px,min-content))] justi1fy-center my-3">
					{people.map((person) => (
						<MembersCard
							key={person.name}
							name={person.name}
							function={person.role}
							email={person.email}
							avatar={person.picture}
						></MembersCard>
					))}
				</div>
			</div>
		</>
	);
}
