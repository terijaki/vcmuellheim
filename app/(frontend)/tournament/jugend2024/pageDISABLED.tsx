import CardTitle from "@/components/CardTitle";
import PageWithHeading from "@/components/layout/PageWithHeading";
import { shuffleArray } from "@/utils/shuffleArray";
import { Card, Center, Divider, Group, Stack, Text } from "@mantine/core";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FaUser as IconAvatar } from "react-icons/fa6";

export const metadata: Metadata = { title: "Jugendturnier 2024" };

// reference of past tournaments
const pastTournamentPosts = [
	["data/posts/2022-07-12-unser-1.jugendturnier-schlug-voll-ein.md", "Turnier 2022"],
	["data/posts/2023-06-21-zweites-internationales-jugendturnier.md", "Turnier 2023"],
];

// contact people for this event
const people = [
	{
		name: "Thomas Seywald",
		email: "thomas@vcmuellheim.de",
		role: "Turnierleitung",
		picture: undefined,
	},
	{
		name: "Björn Kohnen",
		email: "bjoern@vcmuellheim.de",
		role: "Vorstand",
		picture: undefined,
	},
];

export default function JugendturnierPage() {
	const pastImages: string[] = [];

	const shuffledPastImages = shuffleArray(pastImages, 12);

	return (
		<PageWithHeading subtitle="Jugendturnier 2024" title="3. Markgräfler Taxi Cup">
			<Stack>
				<Card>
					<CardTitle>Sei dabei!</CardTitle>
					<Text>
						Der Volleyball Club Müllheim veranstaltet dieses Jahr erneut ein internationales Jugendturnier und du bist
						herzlich eingeladen!
					</Text>
				</Card>
				<Card>
					<CardTitle>Wann geht es los?</CardTitle>
					<Text>
						Am Sonntag den <b>16.06.2024</b> um <b>11:00 Uhr</b> startet das Turnier.
						<br />
						Ab 10:15 Uhr wird die Halle geöffnet und ab 10:30 Uhr gibt es eine kurze Trainerbesprechung.
					</Text>
					<CardTitle>Wo ist das Turnier?</CardTitle>
					<Text>
						Das Turnier findet in der{" "}
						<Link
							href="https://goo.gl/maps/g3XhvCS9gpR2"
							target="_blank"
							className="text-blumine hover:text-turquoise underline underline-offset-2"
						>
							Sporthalle II, Schwarzwaldstraße 12A, 79379 Müllheim
						</Link>{" "}
						statt. Der Eingang befindet sich in einer Gasse der Bismarckstraße gegenüber des Hebel Parks.
					</Text>
					<Text>Die komplette Sporthalle (Abteil A-E) steht für das Volleyballturnier zur Verfügung.</Text>
					<CardTitle>Wie wird gespielt?</CardTitle>
					<Text>Das Turnier wird wie folgt aufgeteilt:</Text>
					<ul className="list-inside list-disc">
						<li>U18 weiblich 6:6 (Jahrgänge 2008/2009)</li>
						<li>U16 weiblich 6:6 (Jahrgänge 2010/2011)</li>
						<li>U16 männlich 6:6 (Jahrgänge 2010/2011)</li>
					</ul>
					<Text>Wir bemühen uns um geringe Wartezeiten für alle Spieler:innen.</Text>
					<CardTitle>Welche Kosten entstehen?</CardTitle>
					<Text>
						Dank unseres Sponsors (
						<Link
							href="https://www.mgl-taxi.de"
							target="_blank"
							className="text-blumine hover:text-turquoise underline underline-offset-2"
						>
							Markgräfler Taxi
						</Link>
						) erheben wir keine Anmeldegebühr und können die Unkosten für dieses Turnier decken. Spenden werden jedoch
						gerne angenommen und fließen in die Mannschaftskassen unserer Helfer:innen.
					</Text>
					<CardTitle>Was muss ich mitbringen?</CardTitle>
					<Text>
						Alle Teilnehmer:innen <span className="italic font-bold">müssen</span> Hallenschuhe tragen!
						<br />
						Wir bitten darum, Essen & Trinken selbst mitzubringen und Abfälle auch selbst wieder mitzunehmen. Kaffee,
						Kuchen und ein paar Kleinigkeiten werden auf Spendenbasis als Buffet angeboten.
					</Text>
					<CardTitle>Wie kann ich uns anmelden?</CardTitle>
					<Text>
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
					</Text>
					<Text>
						Sollten wir zu viele Anmeldungen erhalten, verteilen wir fair anhand der Anmeldezeiten und teilen zunächst 1
						Mannschaft pro Verein ein. Meldet euch aber trotzdem gerne mit allen Mannschaften an, die teilnehmen
						möchten.
					</Text>
				</Card>
				<Card bg="black" c="white">
					{/* <Image
						src="images/sponsors/markgraefler_taxi.png"
						alt={""}
						width={570}
						height={213}
						className="rounded-md shadow"
					/> */}
					<Group justify="center">
						<Link
							href="https://www.mgl-taxi.de"
							target="_blank"
							className="text-lion hover:text-turquoise underline underline-offset-2"
						>
							https://mgl-taxi.de
						</Link>
						<Divider c="white" size="xs" />
						<Link
							href="tel:+4976315588"
							target="_blank"
							className="text-lion hover:text-turquoise underline underline-offset-2"
						>
							07631 55 88
						</Link>
					</Group>
					<Text>Markgräfler Taxi GmbH ist offizieller Sponser des diesjährigen internationalen Jugendturnier.</Text>
				</Card>
				<Card>
					<CardTitle>Bilder aus den vergangenen Jahren</CardTitle>
					<Text c="dimmed">zufällige Auswahl und Reihenfolge</Text>
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
									<Image
										src={image}
										fill
										alt={""}
										className="object-cover group-hover:scale-105 transition-transform duration-700"
									/>
								</Link>
							</div>
						))}
					</div>
					<Text>
						Weitere Bilder findet ihr in den jeweiligen Berichten:
						{pastTournamentPosts.map((post) => (
							<Link
								key={post[0]}
								href={post[0].replace("data/posts/", "../").replace(".md", "")}
								className="text-blumine hover:text-turquoise underline underline-offset-2 ml-2"
							>
								{post[1]}
							</Link>
						))}
					</Text>
				</Card>
				<Card>
					<Stack>
						<CardTitle>Ansprechpersonen</CardTitle>
						<Group>
							{people.map((person) => (
								<Card
									key={person.name}
									component={Link}
									href={person.email ? `mailto:${person.email}` : ""}
									scroll={false}
									p={0}
									withBorder
								>
									<Stack gap={0}>
										<Group gap={0}>
											<Stack w={58} h={64} c="white" pos="relative" align="center" justify="center">
												{person.picture ? (
													<Image fill src={person.picture} alt={person.name} style={{ objectFit: "cover" }} />
												) : (
													<IconAvatar width={"100%"} height={"100%"} />
												)}
											</Stack>
											<Text w={150} p="xs" lineClamp={2} lh="xs">
												{person.name}
											</Text>
										</Group>
										<Center p={2} c="white" bg="blumine">
											<Text size="xs">{person.role}</Text>
										</Center>
									</Stack>
								</Card>
							))}
						</Group>
					</Stack>
				</Card>
			</Stack>
		</PageWithHeading>
	);
}
