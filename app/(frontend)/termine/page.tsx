import CardTitle from "@/components/CardTitle";
import EventCard from "@/components/EventCard";
import Matches from "@/components/Matches";
import PageWithHeading from "@/components/layout/PageWithHeading";
import { getEvents } from "@/data/events";
import { samsLeagueMatches, samsSeasons } from "@/data/sams/sams-server-actions";
import { Club } from "@/project.config";
import { Anchor, Card, CardSection, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import dayjs from "dayjs";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Fragment } from "react";
import { FaBullhorn as IconSubscribe } from "react-icons/fa6";

export const metadata: Metadata = { title: "Termine" };

export const dynamic = "force-dynamic";

export default async function Termine() {
	// load events
	const eventData = await getEvents();
	const events = eventData?.docs;

	// get sams matches
	const leagueMatches = await samsLeagueMatches({ range: "future" });
	const futureMatches = leagueMatches?.matches.filter((m) => m.results?.winner === null);
	const matchCount = futureMatches?.length || 0;
	// TODO include tournament matches (separate sams query)
	// dates
	const seasons = await samsSeasons();
	const currentMonth = dayjs().month() + 1;
	const isOffSeason = currentMonth >= 5 && currentMonth <= 9;

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
							<Title order={2} c="blumine">
								Ligaspiele
							</Title>

							<CardSection p={{ base: undefined, sm: "xl" }}>
								<Matches matches={futureMatches} timestamp={leagueMatches?.timestamp} type="future" />
							</CardSection>
						</Card>
					</Fragment>
				)}
				{/* ZERO MATCHES */}
				{matchCount === 0 && (
					<Fragment>
						<Card>
							<CardTitle>Keine Ligaspiele</CardTitle>
							<Text>Derzeit stehen keine weiteren Spieltermine an.</Text>
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
						{isOffSeason && (
							<Card>
								<Stack>
									<Stack gap={0}>
										<CardTitle>Außerhalb der Saison?</CardTitle>
										<Text>
											Die Saison im Hallenvolleyball findet in der Regel in den Monaten von September bis April statt.
											Dazwischen wird die nächste Saison vorbereitet und die neusten Informationen vom Südbadischen
											Volleyballverband wurden ggf. noch nicht veröffentlicht.
										</Text>
									</Stack>
									{seasons && (
										<Stack gap="xs">
											<Text>Offizielle Zeitspanne der letzten zwei Saisons:</Text>
											<Stack gap={0}>
												<Group>
													<Text fw="bold">Aktuelle Saison</Text>
													<Text fw="bold">
														{`${dayjs(seasons.current.startDate).format("DD.MM.YYYY")} bis ${dayjs(seasons.current.endDate).format("DD.MM.YYYY")}`}
													</Text>
												</Group>
												{seasons.next && (
													<Group>
														<Text>Nächste Saison</Text>
														<Text>
															{`${dayjs(seasons.next.startDate).format("DD.MM.YYYY")} bis ${dayjs(seasons.next.endDate).format("DD.MM.YYYY")}`}
														</Text>
													</Group>
												)}
											</Stack>
										</Stack>
									)}
								</Stack>
							</Card>
						)}
					</Fragment>
				)}
			</Stack>
		</PageWithHeading>
	);
}
