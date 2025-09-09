import { Anchor, BackgroundImage, Box, Card, Center, Container, Flex, Group, List, ListItem, Overlay, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import dayjs from "dayjs";
import { getEvents } from "@/data/events";
import type { Event } from "@/data/payload-types";
import { type LeagueMatches, samsLeagueMatches } from "@/data/sams/sams-server-actions";
import { getOurClubsSamsTeams } from "@/data/samsTeams";
import { SAMS } from "@/project.config";
import "dayjs/locale/de";
import EventCard from "../EventCard";
import MapsLink from "../MapsLink";
import ScrollAnchor from "./ScrollAnchor";

dayjs.locale("de");

const TIME_RANGE: number = 14; // controls the display matches taking place # days in the future
const TIME_RANGE_MAX_MULTIPLIER: number = 3;
const MAX_GAMES: number = 4;

export default async function HomeHeimspiele() {
	// EVENTS
	const eventData = await getEvents();
	const events = eventData?.docs;

	// MATCHES
	// get future matches from our teams
	const leagueMatches = await samsLeagueMatches({ range: "future" });
	const matchesAll = leagueMatches?.matches || [];
	// filter to only matches we are hosting
	const matchesHomeGames = matchesAll?.filter((match) => {
		const hostUuid = match.host;
		const teams = [match._embedded?.team1, match._embedded?.team2];
		if (teams.some((t) => t?.uuid === hostUuid && t?.name.includes(SAMS.name))) return true;
		return false;
	});
	// sort by date
	const matchesHomeGamesSorted = matchesHomeGames?.sort((a, b) => {
		if (!a.date || !b.date) return 0;
		return dayjs(a.date).valueOf() - dayjs(b.date).valueOf();
	});
	// count unique combination of date, location, league
	const uniqueHostsStrings = new Set<string>();
	const homeMatchesToDisplay: LeagueMatches["matches"] = [];
	for (const m of matchesHomeGamesSorted || []) {
		const dateLocationCombi: string = `${m.date}${m.location?.uuid}`;
		if (dayjs(m.date).isAfter(dayjs().add(TIME_RANGE, "days")) && (uniqueHostsStrings.size < MAX_GAMES || uniqueHostsStrings.has(dateLocationCombi))) {
			uniqueHostsStrings.add(dateLocationCombi);
			homeMatchesToDisplay.push(m);
		}
	}

	return (
		<Box bg="blumine">
			<ScrollAnchor name="heimspiele" />
			<BackgroundImage src="/images/backgrounds/pageheading.jpg" py="md" style={{ zIndex: 0 }} pos="relative">
				<Container size="xl" px={{ base: "lg", md: "xl" }}>
					<Stack>
						{/* EVENTS */}
						<EventsList events={events} />

						{/* MATCHES */}
						<HomeMatchesList homeMatches={homeMatchesToDisplay} />
					</Stack>
				</Container>

				<NoMatchesNoEvents matchCount={homeMatchesToDisplay?.length} eventCount={events?.length} />

				<Overlay backgroundOpacity={0.9} color="var(--mantine-color-blumine-filled)" blur={2} zIndex={-1} />
			</BackgroundImage>
		</Box>
	);
}

function EventsList({ events }: { events?: Event[] }) {
	if (!events || events.length === 0) return null;
	return (
		<SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
			{events.map((event) => (
				<EventCard {...event} key={event.id} dark />
			))}
		</SimpleGrid>
	);
}

async function HomeMatchesList({ homeMatches }: { homeMatches?: LeagueMatches["matches"] }) {
	if (!homeMatches || homeMatches.length === 0) return null;

	// league data so that we can get the league name from the league id
	const ourTeams = await getOurClubsSamsTeams();
	const leagues = new Map<string, string>();
	for (const team of ourTeams || []) {
		if (team.leagueUuid && team.leagueName) {
			const cleanLeagueName = team.leagueName;
			// .replace("Nord", "")
			// .replace("Ost", "")
			// .replace("Süd", "")
			// .replace("West", "")
			// .replace("Mitte", "")
			leagues.set(team.leagueUuid, cleanLeagueName);
		}
	}
	// Group by date and locationUuid, then by leagueUuid
	const groupedMatches = homeMatches.reduce(
		(acc, match) => {
			const dateFormatted = dayjs(match.date).format("YYYY-MM-DD");
			const locationUuid = match.location?.uuid || "unknown_location";
			const primaryKey = `${dateFormatted}_${locationUuid}`;
			const secondaryKey = match.leagueUuid || "unknown_league";
			if (!acc[primaryKey]) acc[primaryKey] = {}; // create primary key
			if (!acc[primaryKey][secondaryKey]) acc[primaryKey][secondaryKey] = []; // create secondary key
			acc[primaryKey][secondaryKey].push(match);
			return acc;
		},
		{} as Record<string, Record<string, typeof homeMatches>>,
	);

	return (
		<Stack>
			<Stack gap={0}>
				<Title order={2} c="white">
					{homeMatches.length > 0 ? "Wir laden ein zum Heimspiel!" : "bevorstehende Veranstaltungen"}
				</Title>
				<Text c="white">In den kommenden Tagen spielen wir in Müllheim und freuen uns über jeden Zuschauer!</Text>
			</Stack>
			<SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
				{Object.entries(groupedMatches).map(([dateLocationKey, leagueGroups]) => {
					const [date, _locationUuid] = dateLocationKey.split("_");
					const location = Object.entries(leagueGroups)[0][1][0]?.location;
					// NEW CARD PER DATE AND LOCATION COMBO
					return (
						<Card bg="onyx" c="white" key={dateLocationKey}>
							<Stack>
								<Flex direction={{ base: "column", sm: "row" }} justify="space-between" align={{ base: "flex-start", sm: "center" }} columnGap="sm">
									<time dateTime={date}>
										<Text c="lion" fw="bold">
											{dayjs(date).format("dddd, D MMMM YY")}
										</Text>
									</time>
									<MapsLink
										location={{
											name: location?.name,
											address: {
												postalCode: location?.address?.postcode,
												city: location?.address?.city,
												street: location?.address?.street,
											},
										}}
									/>
								</Flex>
								{Object.entries(leagueGroups).map(([leagueUuid, matches]) => {
									const leagueName = leagues.get(leagueUuid);
									const earliestStartTime = matches.reduce((earliest, match) => {
										const currentTime = dayjs(match.time, "HH:mm");
										return currentTime.isBefore(dayjs(earliest, "HH:mm")) ? match.time : earliest;
									}, matches[0].time);
									// NEW STACK PER LEAGUE (INSIDE THE DATE AND LOCATION CARD)
									return (
										<Stack key={leagueUuid} gap={0}>
											{/* LEAGUE NAME AND TIME */}
											<Group gap="xs">
												{leagueName && <Text fw="bold">{leagueName}</Text>}
												{earliestStartTime && earliestStartTime === "00:00" ? "(Uhrzeit folgt)" : <Text>ab {earliestStartTime} Uhr</Text>}
											</Group>
											{/* GUESTS LIST */}
											<List spacing={0} withPadding listStyleType="none">
												{matches.map((match) => {
													const matchTeams = [match._embedded?.team1, match._embedded?.team2];
													const guests = matchTeams.filter((t) => t?.uuid !== match.host);
													// display the the guest team
													return (
														<ListItem key={guests[0]?.uuid} opacity={0.8}>
															{guests[0]?.name}
														</ListItem>
													);
												})}
											</List>
										</Stack>
									);
								})}
							</Stack>
						</Card>
					);
				})}
			</SimpleGrid>
			<Center>
				<Text c="white">
					Auswärtsspiele findest du im Spielplan der jeweiligen Mannschaft. <LinkToEventsPage />
				</Text>
			</Center>
		</Stack>
	);
}

function NoMatchesNoEvents({ matchCount = 0, eventCount = 0 }: { matchCount?: number; eventCount?: number }) {
	if (eventCount > 0) return null;
	if (matchCount > 0) return null;

	// prepare to display them as words
	const numToWordsDe = require("num-words-de");
	let allMatchesCountWord = numToWordsDe.numToWord(matchCount, {
		uppercase: true,
	});
	if (matchCount > 12) {
		allMatchesCountWord = matchCount; // shows higher numbers as integer
	}
	let allEventsCountWord = numToWordsDe.numToWord(matchCount, {
		uppercase: true,
	});
	if (matchCount > 12) {
		allEventsCountWord = matchCount; // shows higher numbers as integer
	}
	return (
		<Container py="md">
			<Stack c="white" gap={0}>
				<Title order={2} c="white">
					{eventCount >= 1 && matchCount === 0 && "Zunächst keine Veranstaltungen"}
					{eventCount === 0 && matchCount === 0 && "Zunächst keine Heimspiele"}
				</Title>
				<Text>
					In den kommenden {numToWordsDe.numToWord(((TIME_RANGE * TIME_RANGE_MAX_MULTIPLIER) / 7).toFixed(0), { uppercase: false })} Wochen stehen keine
					{matchCount >= 1 ? " Veranstaltungen " : " Spiele in Müllheim "}
					an.
					{matchCount >= 1 && (
						<Text span>
							{matchCount === 1 ? "Einen weiteren Termin zu einem späteren Zeitpunkt findest du" : `${allEventsCountWord} weitere Termine zu einem späteren Zeitpunkt findest du`}
							<LinkToEventsPage />
						</Text>
					)}
				</Text>

				{matchCount >= 1 && (
					<Text>
						Auswärtsspiele findest du im Spielplan der jeweiligen Mannschaft.
						<Text span>{matchCount === 1 ? "Einen weiteren Termin findest du" : `${allMatchesCountWord} weitere Termine unserer Mannschaften findest du`}</Text>
						<LinkToEventsPage />
					</Text>
				)}
			</Stack>
		</Container>
	);
}

function LinkToEventsPage() {
	return (
		<Text span>
			<Text span>» </Text>
			<Anchor href="termine" fw="bold" c="white">
				hier
			</Anchor>
			<Text span> «</Text>
		</Text>
	);
}
