import { Anchor, BackgroundImage, Box, Card, Center, Container, Flex, Group, List, ListItem, Overlay, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import dayjs from "dayjs";
import "dayjs/locale/de";
import { useMemo } from "react";
import type { LeagueMatchesResponse } from "@/lambda/sams/types";
import type { Event } from "@/lib/db/types";
import { useEvents, useSamsMatches, useSamsTeams } from "../../lib/hooks";
import EventCard from "../EventCard";
import MapsLink from "../MapsLink";
import ScrollAnchor from "./ScrollAnchor";

dayjs.locale("de");

const TIME_RANGE = 14; // controls the display matches taking place # days in the future
const TIME_RANGE_MAX_MULTIPLIER = 3;
const MAX_GAMES = 4;

export default function HomeHeimspiele() {
	// Fetch events and matches
	const { data: eventsData } = useEvents();
	const events = eventsData?.items || [];

	const { data: samsTeamsData } = useSamsTeams();
	const ourClubUuid = samsTeamsData?.teams?.find((t) => t.name.includes("Müllheim"))?.sportsclubUuid;

	const { data: matchesData } = useSamsMatches({
		sportsclub: ourClubUuid,
		range: "future",
		limit: 50,
	});

	// Process matches to show only home games
	const homeMatchesToDisplay = useMemo(() => {
		if (!matchesData?.matches) return [];

		const matchesAll = matchesData.matches;

		// Filter to only matches we are hosting
		const matchesHomeGames = matchesAll.filter((match) => {
			const hostUuid = match.host;
			const teams = [match._embedded?.team1, match._embedded?.team2];
			return teams.some((t) => t?.uuid === hostUuid && t?.name.includes("Müllheim"));
		});

		// Sort by date
		const matchesHomeGamesSorted = matchesHomeGames.sort((a, b) => {
			if (!a.date || !b.date) return 0;
			return dayjs(a.date).valueOf() - dayjs(b.date).valueOf();
		});

		// Count unique combination of date, location
		const uniqueHostsStrings = new Set<string>();
		const result: typeof matchesHomeGames = [];

		for (const m of matchesHomeGamesSorted) {
			const dateLocationCombi = `${m.date}${m.location?.uuid}`;
			if (dayjs(m.date).isAfter(dayjs().add(TIME_RANGE, "days")) && (uniqueHostsStrings.size < MAX_GAMES || uniqueHostsStrings.has(dateLocationCombi))) {
				uniqueHostsStrings.add(dateLocationCombi);
				result.push(m);
			}
		}

		return result;
	}, [matchesData]);

	return (
		<Box bg="blumine">
			<ScrollAnchor name="heimspiele" />
			<BackgroundImage src="/assets/backgrounds/pageheading.jpg" py="md" style={{ zIndex: 0 }} pos="relative">
				<Container size="xl" px={{ base: "lg", md: "xl" }}>
					<Stack>
						{/* EVENTS */}
						<EventsList events={events} />

						{/* MATCHES */}
						<HomeMatchesList homeMatches={homeMatchesToDisplay} />
					</Stack>
				</Container>

				<NoMatchesNoEvents matchCount={homeMatchesToDisplay.length} eventCount={events.length} />

				<Overlay backgroundOpacity={0.9} color="var(--mantine-color-blumine-filled)" blur={2} zIndex={-1} />
			</BackgroundImage>
		</Box>
	);
}

function EventsList({ events }: { events: Event[] }) {
	if (!events || events.length === 0) return null;
	const isMultiple = events.length > 1;
	return (
		<>
			<Stack gap={0}>
				<Title order={2} c="white">
					{isMultiple ? "Termine" : "Termin"}
				</Title>
				<Text c="white">{isMultiple ? "Bevorstehende Vereinstermine" : "Bevorstehender Termin"}</Text>
			</Stack>
			<SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
				{events.map((event) => (
					<EventCard {...event} key={event.id} dark />
				))}
			</SimpleGrid>
		</>
	);
}

function HomeMatchesList({ homeMatches }: { homeMatches: LeagueMatchesResponse["matches"] }) {
	const { data: samsTeamsData } = useSamsTeams();

	if (!homeMatches || homeMatches.length === 0) return null;

	// league data so that we can get the league name from the league id
	const leagues = new Map<string, string>();
	for (const team of samsTeamsData?.teams || []) {
		if (team.leagueUuid && team.leagueName) {
			const cleanLeagueName = team.leagueName;
			leagues.set(team.leagueUuid, cleanLeagueName);
		}
	}

	// Group by date and locationUuid, then by leagueUuid
	type MatchesArray = typeof homeMatches;
	type GroupedMatches = Record<string, Record<string, MatchesArray>>;

	const groupedMatches = homeMatches.reduce<GroupedMatches>((acc, match) => {
		const dateFormatted = dayjs(match.date).format("YYYY-MM-DD");
		const locationUuid = match.location?.uuid || "unknown_location";
		const primaryKey = `${dateFormatted}_${locationUuid}`;
		const secondaryKey = match.leagueUuid || "unknown_league";
		if (!acc[primaryKey]) acc[primaryKey] = {}; // create primary key
		if (!acc[primaryKey][secondaryKey]) acc[primaryKey][secondaryKey] = []; // create secondary key
		acc[primaryKey][secondaryKey].push(match);
		return acc;
	}, {});

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
					const firstLeagueMatches = Object.values(leagueGroups)[0];
					const location = firstLeagueMatches?.[0]?.location;

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
									<MapsLink name={location?.name} street={location?.address?.street} postal={location?.address?.postcode} city={location?.address?.city} />
								</Flex>
								{Object.entries(leagueGroups).map(([leagueUuid, matches]) => {
									const leagueName = leagues.get(leagueUuid);
									const matchesArray = matches as MatchesArray;
									const earliestStartTime = matchesArray.reduce((earliest, match) => {
										const currentTime = dayjs(match.time, "HH:mm");
										return currentTime.isBefore(dayjs(earliest, "HH:mm")) ? match.time : earliest;
									}, matchesArray[0]?.time);

									// NEW STACK PER LEAGUE (INSIDE THE DATE AND LOCATION CARD)
									return (
										<Stack key={leagueUuid} gap={0}>
											{/* LEAGUE NAME AND TIME */}
											<Group gap="xs">
												{leagueName && <Text fw="bold">{leagueName}</Text>}
												{earliestStartTime && earliestStartTime === "00:00" ? <Text>(Uhrzeit folgt)</Text> : <Text>ab {earliestStartTime} Uhr</Text>}
											</Group>
											{/* GUESTS LIST */}
											<List spacing={0} withPadding listStyleType="none">
												{matchesArray.map((match) => {
													const matchTeams = [match._embedded?.team1, match._embedded?.team2];
													const guests = matchTeams.filter((t) => t?.uuid !== match.host);
													// display the guest team
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
			<Center my="md">
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

	const weeksCount = Math.round((TIME_RANGE * TIME_RANGE_MAX_MULTIPLIER) / 7);

	return (
		<Container py="md">
			<Stack c="white" gap={0}>
				<Title order={2} c="white">
					{eventCount >= 1 && matchCount === 0 && "Zunächst keine Veranstaltungen"}
					{eventCount === 0 && matchCount === 0 && "Zunächst keine Heimspiele"}
				</Title>
				<Text>
					In den kommenden {weeksCount} Wochen stehen keine
					{matchCount >= 1 ? " Veranstaltungen " : " Spiele in Müllheim "}
					an.
					{matchCount >= 1 && (
						<Text span>
							{" "}
							{matchCount === 1 ? "Einen weiteren Termin zu einem späteren Zeitpunkt findest du" : `${matchCount} weitere Termine zu einem späteren Zeitpunkt findest du`}
							<LinkToEventsPage />
						</Text>
					)}
				</Text>

				{matchCount >= 1 && (
					<Text>
						Auswärtsspiele findest du im Spielplan der jeweiligen Mannschaft.
						<Text span> {matchCount === 1 ? "Einen weiteren Termin findest du" : `${matchCount} weitere Termine unserer Mannschaften findest du`}</Text>
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
