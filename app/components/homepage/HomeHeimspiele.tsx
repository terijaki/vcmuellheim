import getEvents from "@/app/utils/getEvents";
import { samsClubMatches } from "@/app/utils/sams/sams-server-actions";
import { SAMS } from "@/project.config";
import dayjs from "dayjs";
import { unstable_cacheLife as cacheLife } from "next/cache";
import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import { FaAngleLeft as IconLeft, FaLocationDot as IconLocation, FaAngleRight as IconRight } from "react-icons/fa6";
import type { Match } from "sams-rpc";
import HeimspieleEvents from "./HeimspieleEvents";

const TIME_RANGE: number = 14; // controls the display matches taking place # days in the future
const TIME_RANGE_MAX_MULTIPLIER: number = 3;
const MIN_GAMES: number = 2;
const MAX_GAMES: number = 4;

export default async function HomeHeimspiele() {
	"use cache";
	cacheLife("hours");

	testMinRange();

	// get events // filter by max range
	// get matches // filter my home games // filter by max range
	// combine matches by unique home game combination

	// CUSTOM EVENTS
	const eventsToDisplay = await getEvents(0);

	// MATCHES
	// get future matches from our teams
	const allMatches = await samsClubMatches({ future: true });
	// filter reduce to matches we are hosting
	const homeGames = allMatches?.filter((match) => match.host?.club?.includes(SAMS.name));
	// sort by date
	const homeGamesSorted = homeGames?.sort(
		(b, a) => Number(new Date(a.date).getTime()) - Number(new Date(b.date).getTime()),
	);
	// count unique combination of date, location, league
	const uniqueHostsStrings: string[] = [];
	const matchesToDisplay: Match[] = [];
	homeGamesSorted?.map((m) => {
		const dateLocationCombi: string = m.date + m.matchSeries.name + m.location.id; // string to avoid duplicates if two teams are in the same league
		if (
			dayjs(m.date).isAfter(dayjs().add(TIME_RANGE, "days")) &&
			uniqueHostsStrings.length >= MAX_GAMES &&
			!uniqueHostsStrings.includes(dateLocationCombi)
		) {
			uniqueHostsStrings.push(dateLocationCombi);
			matchesToDisplay.push(m);
		}
	});

	// if there is at least one home game, display the matches
	if (eventsToDisplay.length >= 1 || matchesToDisplay.length >= 1) {
		// arrays to sort and fill throghout the following process
		const matchBuffer: string[] = [];
		return (
			<section className="col-full-content grid grid-cols-main-grid section-bg-gradient after:opacity-95">
				<div id="heimspiele" className="scroll-anchor" />
				<Image
					width={948}
					height={639}
					alt=""
					loading="lazy"
					src="/images/backgrounds/pageheading.jpg"
					className="absolute w-full h-full z-[-10] object-cover"
				/>
				<div className="col-center-content py-8 sm:py-12">
					{/* HEADING */}
					<h2 className="text-center md:text-left text-white font-bold text-3xl">
						{eventsToDisplay.length < 1 ? "Wir laden ein zum Heimspiel!" : "bevorstehende Veranstaltungen"}
					</h2>
					{/* EVENTS */}
					{eventsToDisplay.length > 0 && (
						<div className="col-center-content columns-1 sm:has-[>:nth-of-type(2)]:columns-2 md:columns-2 lg:has-[>:nth-of-type(5)]:columns-3 gap-4 mt-3">
							{eventsToDisplay.map((event) => (
								<HeimspieleEvents {...event} key={event.title + event.start} />
							))}
						</div>
					)}
					{/* MATCHES */}
					{matchesToDisplay.length > 0 && (
						<>
							<p className="text-center md:text-left text-balance text-white py-2">
								In den kommenden Tagen spielen wir in Müllheim und freuen uns über jeden Zuschauer!
							</p>
							<div className="col-center-content columns-1 sm:has-[>:nth-of-type(2)]:columns-2 md:columns-2 lg:has-[>:nth-of-type(5)]:columns-3 gap-4 mt-3">
								{matchesToDisplay.map((match) => {
									// group games together
									const dateLocationCombi: string = `dlc${match.date}${match.location?.id}`; // this is used to group games together
									const groupFilterOne = !matchBuffer.includes(match.uuid) && !matchBuffer.includes(dateLocationCombi);
									if (groupFilterOne) {
										matchBuffer.push(match.uuid); // makes sure the specific match is already rendered, this avoids duplicates if two of our teams play against each other
										matchBuffer.push(dateLocationCombi); // this groups games together if date and location match
										return (
											<div
												className="card bg-onyx text-white inline-block w-full break-inside-avoid mb-3"
												key={match.uuid}
											>
												<div>
													<time dateTime={match.date} className="text-lion mr-1">
														{match.date}
													</time>
													<Link
														href={`https://www.google.com/maps/search/?api=1&query=${match.location?.street},${match.location?.postalCode},${match.location?.city},${match.location?.name}`}
														target="_blank"
														rel="noopener noreferrer"
														className="text-turquoise"
													>
														<IconLocation className="inline align-baseline" />
														{match.location?.name}
														<span className="hidden xl:inline">, {match.location?.street}</span>
													</Link>

													{/* dateTimeLeagueLocationCombi */}
													{matchesToDisplay.map((matchLeagueTime, index) => {
														const dateTimeLeagueLocationCombi: string = `dtllc${match.date}${matchLeagueTime.time}${matchLeagueTime.matchSeries?.name}${match.location?.name}`; // this is used to group games
														const groupFilterTwo = groupFilterOne && !matchBuffer.includes(dateTimeLeagueLocationCombi);
														if (
															groupFilterTwo &&
															match.date === matchLeagueTime.date &&
															match.location?.id === matchLeagueTime.location?.id
														) {
															matchBuffer.push(dateTimeLeagueLocationCombi); // this groups games together if date and location match
															return (
																<Fragment key={`League Name and Time ${matchLeagueTime.uuid}`}>
																	{/* League Name and Time */}
																	<p className="font-bold flex gap-1">
																		<span>
																			{matchLeagueTime.matchSeries?.name
																				?.replace("Nord", "")
																				.replace("Ost", "")
																				.replace("Süd", "")
																				.replace("West", "")}
																		</span>
																		<span>ab {matchLeagueTime.time} Uhr</span>
																	</p>
																	{/* fetch the guest for this date, time, league and location combination */}
																	<ul>
																		{matchesToDisplay.map((matchGuest) => {
																			if (
																				matchLeagueTime.location?.id === matchGuest.location?.id &&
																				match.date === matchGuest.date &&
																				matchLeagueTime.matchSeries?.uuid === matchGuest.matchSeries?.uuid
																			) {
																				return (
																					<Fragment key={`Guests${matchGuest.uuid}`}>
																						{matchGuest.team?.map((teamGuest) => {
																							if (
																								teamGuest.id !== matchGuest.host?.id &&
																								!matchBuffer.includes(teamGuest.id + dateLocationCombi)
																							) {
																								matchBuffer.push(teamGuest.id + dateLocationCombi);
																								return (
																									<li key={teamGuest.id} className="pl-4 opacity-75">
																										{teamGuest.name}
																										{matchGuest.team?.map((teamCheckTwo, index, array) => {
																											if (
																												array[0].club === matchGuest.host?.club &&
																												array[1].club === matchGuest.host?.club &&
																												teamCheckTwo.name !== matchGuest.host?.club
																											) {
																												if (teamCheckTwo.name === matchGuest.host?.name) {
																													return ` : ${teamCheckTwo.name}`;
																												}
																											}
																										})}
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
												</div>
											</div>
										);
									}
								})}
							</div>
							<p className="mt-3 text-white text-balance text-center sm:text-left">
								Auswärtsspiele findest du im Spielplan der jeweiligen Mannschaft.
								<span className="ml-1 sm:ml-0 sm:block *:inline *:align-text-center">
									Alle offiziellen Termine unserer Mannschaften findest du
									<IconRight className="animate-pulse text-sm mb-1" />
									<IconRight className="-ml-2.5 animate-pulse mb-1" />
									<Link href="termine" className="gap-1 font-bold group">
										hier
									</Link>
									<IconLeft className="-mr-2.5 animate-pulse mb-1" />
									<IconLeft className="animate-pulse text-sm mb-1" />
								</span>
							</p>
						</>
					)}
				</div>
			</section>
		);
	}

	return <NoMatches matchCount={allMatches?.length} />;
}

// tests
function testMinRange() {
	if (Number(((TIME_RANGE * TIME_RANGE_MAX_MULTIPLIER) / 7).toFixed(0)) < 2) {
		throw "Time range for Home Games too short. Min 2 weeks required or else the number as word display is messed up. (Also it makes no sense to have it such a short range).";
	}
}

async function NoMatches({ matchCount = 0 }: { matchCount?: number }) {
	// check how many matches we have in total

	// check how many events we have in total
	const allEventsCount = (await getEvents(0, 365)).length;
	// prepare to display them as words
	const numToWordsDe = require("num-words-de");
	let allMatchesCountWord = numToWordsDe.numToWord(matchCount, {
		uppercase: true,
	});
	if (matchCount > 12) {
		allMatchesCountWord = matchCount; // shows higher numbers as integer
	}
	let allEventsCountWord = numToWordsDe.numToWord(allEventsCount, {
		uppercase: true,
	});
	if (allEventsCount > 12) {
		allEventsCountWord = allEventsCount; // shows higher numbers as integer
	}
	return (
		<section className="col-full-content grid grid-cols-main-grid section-bg-gradient after:opacity-95">
			<div id="heimspiele" className="scroll-anchor" />
			<Image
				width={948}
				height={639}
				alt=""
				loading="lazy"
				src="/images/backgrounds/pageheading.jpg"
				className="absolute w-full h-full z-[-10] object-cover"
			/>
			<div className="col-center-content py-8 sm:py-12">
				<h2 className="text-center md:text-left text-white font-bold text-3xl">
					{allEventsCount >= 1 && matchCount === 0 && "Zunächst keine Veranstaltungen"}
					{allEventsCount === 0 && matchCount === 0 && "Zunächst keine Heimspiele"}
				</h2>
				<p className="text-center md:text-left text-white py-2 text-balance">
					In den kommenden{" "}
					{numToWordsDe.numToWord(((TIME_RANGE * TIME_RANGE_MAX_MULTIPLIER) / 7).toFixed(0), { uppercase: false })}{" "}
					Wochen stehen keine
					{allEventsCount >= 1 && matchCount === 0 ? " Veranstaltungen " : " Spiele in Müllheim "}
					an.
					{allEventsCount >= 1 && matchCount === 0 && (
						<span className="ml-1 sm:ml-0 sm:block *:inline *:align-text-center">
							{allEventsCount === 1
								? "Einen weiteren Termin zu einem späteren Zeitpunkt findest du"
								: `${allEventsCountWord} weitere Termine zu einem späteren Zeitpunkt findest du`}
							<IconRight className="animate-pulse text-sm mb-1" />
							<IconRight className="-ml-2.5 animate-pulse mb-1" />
							<Link href="termine" className="gap-1 font-bold group">
								hier
							</Link>
							<IconLeft className="-mr-2.5 animate-pulse mb-1" />
							<IconLeft className="animate-pulse text-sm mb-1" />
						</span>
					)}
				</p>
				{matchCount >= 1 && (
					<p className="text-center md:text-left mt-3 text-white  text-balance">
						Auswärtsspiele findest du im Spielplan der jeweiligen Mannschaft.
						<span className="ml-1 sm:ml-0 sm:block *:inline *:align-text-center">
							{matchCount === 1
								? "Einen weiteren Termin findest du"
								: `${allMatchesCountWord} weitere Termine unserer Mannschaften findest du`}
							<IconRight className="animate-pulse text-sm mb-1" />
							<IconRight className="-ml-2.5 animate-pulse mb-1" />
							<Link href="termine" className="gap-1 font-bold group">
								hier
							</Link>
							<IconLeft className="-mr-2.5 animate-pulse mb-1" />
							<IconLeft className="animate-pulse text-sm mb-1" />
						</span>
					</p>
				)}
			</div>
		</section>
	);
}
