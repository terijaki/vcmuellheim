import CardTitle from "@/components/CardTitle";
import CenteredLoader from "@/components/CenteredLoader";
import EventCard from "@/components/EventCard";
import Matches from "@/components/Matches";
import PageWithHeading from "@/components/layout/PageWithHeading";
import { getEvents } from "@/data/events";
import { samsLeagueMatches, samsSeasons } from "@/data/sams/sams-server-actions";
import { Club } from "@/project.config";
import { Anchor, Card, CardSection, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import dayjs from "dayjs";
import type { Metadata } from "next";
import { unstable_cacheTag as cacheTag } from "next/cache";
import { headers } from "next/headers";
import { Fragment, Suspense } from "react";
import { FaBullhorn as IconSubscribe } from "react-icons/fa6";

export const metadata: Metadata = { title: "Termine" };

export default async function Termine() {
	// webcal link
	const headersList = await headers();
	const host = process.env.NODE_ENV === "development" && headersList.get("host");
	const webcalLink = `webcal://${host || Club.domain}/ics/all.ics`;

	return (
		<PageWithHeading title="Termine">
			<Stack>
				<Card>
					<Stack>
						<CardTitle>Kalender Integration</CardTitle>
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
					</Stack>
				</Card>
				<Suspense fallback={<CenteredLoader text="Lade Termine..." />}>
					<EventsContent />
					<MatchesContent />
				</Suspense>
			</Stack>
		</PageWithHeading>
	);
}

async function EventsContent() {
	"use cache";
	cacheTag("events");
	// load events
	const eventData = await getEvents();
	const events = eventData?.docs;

	return (
		<>
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
		</>
	);
}

async function MatchesContent() {
	"use cache";
	cacheTag("sams-league-matches");
	// get sams matches
	const leagueMatches = await samsLeagueMatches({ range: "future" });
	// TODO include tournament matches (separate sams query)

	// seasons
	const seasons = await samsSeasons();
	const currentMonth = dayjs().month() + 1;
	const isOffSeason = currentMonth >= 5 && currentMonth <= 9;

	if (leagueMatches && leagueMatches?.matches.length > 0) {
		return (
			<Card>
				<Title order={2} c="blumine">
					Ligaspiele
				</Title>

				<CardSection p={{ base: undefined, sm: "xl" }}>
					<Matches matches={leagueMatches.matches} timestamp={leagueMatches?.timestamp} type="future" />
				</CardSection>
			</Card>
		);
	}

	// fallback
	return (
		<Fragment>
			<Card>
				<CardTitle>Keine Ligaspiele</CardTitle>
				<Text>Derzeit stehen keine weiteren Spieltermine an.</Text>
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
											{`${dayjs(seasons.current.startDate).format("YYYY")}/${dayjs(seasons.current.endDate).format("YY")}`}
										</Text>
									</Group>
									{seasons.next && (
										<Group>
											<Text>Nächste Saison</Text>
											<Text>
												{`${dayjs(seasons.next.startDate).format("YYYY")}/${dayjs(seasons.next.endDate).format("YY")}`}
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
	);
}
