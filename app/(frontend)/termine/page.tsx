import EventCard from "@/components/EventCard";
import Matches from "@/components/Matches";
import PageWithHeading from "@/components/layout/PageWithHeading";
import { getEvents } from "@/data/events";
import { Club } from "@/project.config";
import { samsClubMatches, samsSeasons } from "@/utils/sams/sams-server-actions";
import { Anchor, Card, CardSection, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import dayjs from "dayjs";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Fragment } from "react";
import { FaBullhorn as IconSubscribe } from "react-icons/fa6";

export const metadata: Metadata = { title: "Termine" };

export const dynamic = "force-dynamic";

export default async function Termine() {
	// load events
	const eventData = await getEvents();
	const events = eventData?.docs;

	// get sams matches
	const futureMatches = await samsClubMatches({ future: true });
	const matchCount = futureMatches?.filter((m) => m.matchSeries.type.toLowerCase() === "league").length || 0;
	const turnamentCount = futureMatches?.filter((m) => m.matchSeries.type.toLowerCase() === "competition").length || 0;

	// dates
	const currentMonth = new Date().getMonth() + 1;
	const seasonMonth = !!(currentMonth >= 5 && currentMonth <= 9);
	const seasons = await samsSeasons();
	const pastTwoSeasons = seasons?.slice(0, 2) || [];

	// webcal link
	const headersList = await headers();
	const host = process.env.NODE_ENV === "development" && headersList.get("host");
	const webcalLink = `webcal://${host || Club.domain}/ics/all.ics`;

	return (
		<PageWithHeading title="Termine">
			<Stack>
				{/* CUSTOM EVENTS */}
				{events && events.length > 0 && (
					<Card>
						<Title order={2} c="blumine">
							Veranstaltungen
						</Title>
						<SimpleGrid cols={{ base: 1, md: 2 }}>
							{events.map((event) => {
								return <EventCard {...event} key={event.id} />; //TODO create a new event card. THIS ONE IS ALSO USED ON THE HOMEPAGE. but it makes sense to have two separate design
							})}
						</SimpleGrid>
					</Card>
				)}
				{/* MATCHES */}
				{futureMatches && futureMatches.length > 0 && (
					<Fragment>
						<Card>
							<Title order={2} c="blumine">
								Vereinskalender
							</Title>
							<Text>
								<Anchor href={webcalLink} style={{ display: "inline-flex", gap: 4 }}>
									<IconSubscribe /> Abboniere unseren Vereinskalender
								</Anchor>
								, um neue Termine saisonübergreifend automatisch in deiner{" "}
								<Text fw="bold" span>
									Kalender-App
								</Text>{" "}
								zu empfangen.
							</Text>
						</Card>
						<Card>
							{turnamentCount === 0 ? (
								<Title order={2} c="blumine">
									Ligaspiele
								</Title>
							) : (
								<Title order={2} c="blumine">
									Ligaspiele & Turneire
								</Title>
							)}
							<CardSection>
								<Matches matches={futureMatches} type="future" />
							</CardSection>
						</Card>
					</Fragment>
				)}
				{/* ZERO MATCHES */}
				{matchCount === 0 && (
					<Fragment>
						<Card>
							<Title order={2} c="blumine">
								Keine Ligaspiele
							</Title>
							<Text>Derzeit stehen keine weiteren Spieltermine an.</Text>
							{seasonMonth && (
								<Text>
									Die Saison im Hallenvolleyball findet in der Regel in den Monaten von September bis April statt.
								</Text>
							)}
							<Text span>
								<Link href={webcalLink} className="hyperlink">
									<Group gap="xs">
										<IconSubscribe /> Abboniere unseren Kalender
									</Group>
								</Link>
								, um neue Termine saisonübergreifend automatisch in deiner{" "}
								<Text fw="bold" span>
									Kalender-App
								</Text>{" "}
								zu empfangen.
							</Text>
						</Card>
						{currentMonth >= 4 && currentMonth <= 9 && (
							<Card>
								<Title order={2} c="blumine">
									Außerhalb der Saison?
								</Title>
								<Text>
									Die Saison im Hallenvolleyball findet in der Regel in den Monaten von September bis April statt.
									Dazwischen wird die nächste Saison vorbereitet und die neusten Informationen vom Südbadischen
									Volleyballverband wurden ggf. noch nicht veröffentlicht.
								</Text>
								{pastTwoSeasons.length === 2 && (
									<>
										<p className="mt-3">Offizielle Zeitspanne der letzten zwei Saisons:</p>
										{pastTwoSeasons.map((season) => (
											<ul key={season.id}>
												<li className="list-disc ml-6">
													{`${dayjs(season.begin).format("YYYY-MM-DD")} bis ${dayjs(season.end).format("YYYY-MM-DD")}`}
												</li>
											</ul>
										))}
									</>
								)}
							</Card>
						)}
					</Fragment>
				)}
			</Stack>
		</PageWithHeading>
	);
}
