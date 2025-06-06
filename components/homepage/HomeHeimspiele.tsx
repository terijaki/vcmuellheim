import { getEvents } from "@/data/events";
import type { Event } from "@/data/payload-types";
import { type LeagueMatches, samsLeagueMatches } from "@/data/sams/sams-server-actions";
import { SAMS } from "@/project.config";
import {
	Anchor,
	BackgroundImage,
	Box,
	Card,
	Container,
	Group,
	Overlay,
	SimpleGrid,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import dayjs from "dayjs";
import Link from "next/link";
import { Fragment } from "react";
import { FaAngleLeft as IconLeft, FaAngleRight as IconRight } from "react-icons/fa6";
import EventCard from "../EventCard";
import MapsLink from "../MapsLink";
import ScrollAnchor from "./ScrollAnchor";

const TIME_RANGE: number = 14; // controls the display matches taking place # days in the future
const TIME_RANGE_MAX_MULTIPLIER: number = 3;
const MIN_GAMES: number = 2;
const MAX_GAMES: number = 4;

export default async function HomeHeimspiele() {
	// EVENTS
	const eventData = await getEvents();
	const events = eventData?.docs;

	// MATCHES
	// get future matches from our teams
	const leagueMatches = await samsLeagueMatches({});
	const matchesAll = leagueMatches?.matches || [];
	// filter to only matches we are hosting
	const matchesHomeGames = matchesAll?.filter((match) => {
		const hostUuid = match.host;
		const teams = [match._embedded?.team1, match._embedded?.team2];
		if (teams.some((t) => t?.uuid === hostUuid && t?.name.includes(SAMS.name))) return true;
	});
	// sort by date
	const matchesHomeGamesSorted = matchesHomeGames?.sort((b, a) => {
		if (!a.date || !b.date) return 0;
		return dayjs(a.date).valueOf() - dayjs(b.date).valueOf();
	});
	// count unique combination of date, location, league
	const uniqueHostsStrings: string[] = [];
	const homeMatchesToDisplay: LeagueMatches["matches"] = [];
	matchesHomeGamesSorted?.map((m) => {
		const dateLocationCombi: string = `${m.date}${m.leagueUuid}${m.location?.uuid}`; // string to avoid duplicates if two teams are in the same league
		if (
			dayjs(m.date).isAfter(dayjs().add(TIME_RANGE, "days")) &&
			uniqueHostsStrings.length >= MAX_GAMES &&
			!uniqueHostsStrings.includes(dateLocationCombi)
		) {
			uniqueHostsStrings.push(dateLocationCombi);
			homeMatchesToDisplay.push(m);
		}
	});

	return (
		<Box bg="blumine">
			<ScrollAnchor name="heimspiele" />
			<BackgroundImage src="/images/backgrounds/pageheading.jpg" py="md" style={{ zIndex: 0 }} pos="relative">
				<Container size="xl">
					<Stack>
						{/* EVENTS */}
						<EventsList events={events} />

						{/* MATCHES */}
						<HomeMatchesList homeMatches={matchesHomeGamesSorted} />
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

function HomeMatchesList({ homeMatches }: { homeMatches?: LeagueMatches["matches"] }) {
	if (!homeMatches || homeMatches.length === 0) return null;

	// arrays to sort and fill throghout the following process
	const matchBuffer: string[] = [];

	return (
		<Stack>
			<Title order={2} c="white">
				{homeMatches.length > 0 ? "Wir laden ein zum Heimspiel!" : "bevorstehende Veranstaltungen"}
			</Title>
			<Text c="white">In den kommenden Tagen spielen wir in Müllheim und freuen uns über jeden Zuschauer!</Text>
			<SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
				{homeMatches.map((match) => {
					// group games together
					const dateLocationCombi: string = `dlc${match.date}${match.location?.uuid}`; // this is used to group games together
					const groupFilterOne = !matchBuffer.includes(match.uuid) && !matchBuffer.includes(dateLocationCombi);
					if (groupFilterOne) {
						matchBuffer.push(match.uuid); // makes sure the specific match is already rendered, this avoids duplicates if two of our teams play against each other
						matchBuffer.push(dateLocationCombi); // this groups games together if date and location match
						return (
							<Card bg="onyx" key={match.uuid}>
								<Stack>
									<time dateTime={match.date}>
										<Text c="lion">{match.date}</Text>
									</time>
									<MapsLink
										location={{
											name: match.location?.name,
											address: {
												postalCode: match.location?.address?.postcode,
												city: match.location?.address?.city,
												street: match.location?.address?.street,
											},
										}}
									/>

									{/* dateTimeLeagueLocationCombi */}
									{homeMatches.map((matchLeagueTime) => {
										const dateTimeLeagueLocationCombi: string = `dtllc${match.date}${matchLeagueTime.time}${matchLeagueTime.leagueUuid}${match.location?.name}`; // this is used to group games
										const groupFilterTwo = groupFilterOne && !matchBuffer.includes(dateTimeLeagueLocationCombi);
										if (
											groupFilterTwo &&
											match.date === matchLeagueTime.date &&
											match.location?.uuid === matchLeagueTime.location?.uuid
										) {
											matchBuffer.push(dateTimeLeagueLocationCombi); // this groups games together if date and location match
											return (
												<Fragment key={`League Name and Time ${matchLeagueTime.uuid}`}>
													{/* League Name and Time */}
													<p className="font-bold flex gap-1">
														{/* <span> //TODO see if we can get the league name
															{matchLeagueTime.matchSeries?.name
																?.replace("Nord", "")
																.replace("Ost", "")
																.replace("Süd", "")
																.replace("West", "")}
														</span> */}
														<span>ab {matchLeagueTime.time} Uhr</span>
													</p>
													{/* fetch the guest for this date, time, league and location combination */}
													<ul>
														{homeMatches.map((matchGuest) => {
															if (
																matchLeagueTime.location?.uuid === matchGuest.location?.uuid &&
																match.date === matchGuest.date &&
																matchLeagueTime.leagueUuid === matchGuest.leagueUuid
															) {
																const guestTeams = [matchGuest._embedded?.team1, matchGuest._embedded?.team2];
																return (
																	<Fragment key={`Guests${matchGuest.uuid}`}>
																		{guestTeams?.map((t) => {
																			if (
																				t?.uuid !== matchGuest.host &&
																				!matchBuffer.includes(t?.uuid + dateLocationCombi)
																			) {
																				matchBuffer.push(t?.uuid + dateLocationCombi);
																				return (
																					<li key={t?.uuid} className="pl-4 opacity-75">
																						{t?.name}
																						{/* {guestTeams?.map((teamCheckTwo, index, array) => {
																							if ( // FIX this display
																								array[0].club === matchGuest.host?.club &&
																								array[1].club === matchGuest.host?.club &&
																								teamCheckTwo.name !== matchGuest.host?.club
																							) {
																								if (teamCheckTwo.name === matchGuest.host?.name) {
																									return ` : ${teamCheckTwo.name}`;
																								}
																							}
																						})} */}
																					</li>
																				);
																			}
																		})}
																	</Fragment>
																);
															}
														})}
													</ul>
												</Fragment>
											);
										}
									})}
								</Stack>
							</Card>
						);
					}
				})}
			</SimpleGrid>
			<Text>
				Auswärtsspiele findest du im Spielplan der jeweiligen Mannschaft.
				<LinkToEventsPage />
			</Text>
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
					In den kommenden{" "}
					{numToWordsDe.numToWord(((TIME_RANGE * TIME_RANGE_MAX_MULTIPLIER) / 7).toFixed(0), { uppercase: false })}{" "}
					Wochen stehen keine
					{matchCount >= 1 ? " Veranstaltungen " : " Spiele in Müllheim "}
					an.
					{matchCount >= 1 && (
						<Text span>
							{matchCount === 1
								? "Einen weiteren Termin zu einem späteren Zeitpunkt findest du"
								: `${allEventsCountWord} weitere Termine zu einem späteren Zeitpunkt findest du`}
							<IconRight className="animate-pulse text-sm mb-1" />
							<IconRight className="-ml-2.5 animate-pulse mb-1" />
							<Link href="termine" className="gap-1 font-bold group">
								hier
							</Link>
							<IconLeft className="-mr-2.5 animate-pulse mb-1" />
							<IconLeft className="animate-pulse text-sm mb-1" />
						</Text>
					)}
				</Text>

				{matchCount >= 1 && (
					<Text>
						Auswärtsspiele findest du im Spielplan der jeweiligen Mannschaft.
						<Text span>
							{matchCount === 1
								? "Einen weiteren Termin findest du"
								: `${allMatchesCountWord} weitere Termine unserer Mannschaften findest du`}
						</Text>
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
			<Group gap={0}>
				<IconRight className="animate-pulse text-sm mb-1" />
				<IconRight className="-ml-2.5 animate-pulse mb-1" />
				<Anchor href="termine" fw="bold" c="white">
					hier
				</Anchor>
				<IconLeft className="-mr-2.5 animate-pulse mb-1" />
				<IconLeft className="animate-pulse text-sm mb-1" />
			</Group>
		</Text>
	);
}
