import getEvents from "@/app/utils/getEvents";
import { cachedGetTeamIds } from "@/app/utils/sams/cachedGetClubData";
import { cachedGetMatches } from "@/app/utils/sams/cachedGetMatches";
import ExportedImage from "next-image-export-optimizer";
import Link from "next/link";
import { Fragment } from "react";
import { FaLocationDot as IconLocation, FaAngleRight as IconRight, FaAngleLeft as IconLeft } from "react-icons/fa6";
import { matchType } from "@/app/utils/sams/typeMatches";
import { eventObject } from "@/app/utils/getEvents";
import HeimspieleEvents from "./HeimspieleEvents";

let TIME_RANGE: number = 14; // controls the display matches taking place # days in the future
let TIME_RANGE_MAX_MULTIPLIER: number = 3;
const MIN_GAMES: number = 2,
	MAX_GAMES: number = 4;

export default function HomeHeimspiele() {
	testMinRange();
	let eventsToDisplay: eventObject[] = [];
	let matchesToDisplay: matchType[] = [];
	let loopCount = 0;

	while (eventsToDisplay.length == 0 && matchesToDisplay.length == 0 && TIME_RANGE_MAX_MULTIPLIER > loopCount) {
		// CUSTOM EVENTS
		eventsToDisplay = getEvents(0, TIME_RANGE * (1 + loopCount));

		// MATCHES

		// construct the cut off date. dates after this value are excluded
		const todayPlusRange = new Date();
		todayPlusRange.setDate(todayPlusRange.getDate() + TIME_RANGE * (1 + loopCount));
		// get future matches from our teams
		let allMatches = cachedGetMatches(cachedGetTeamIds("id"), "future"); //TODO add support for turnaments (official SBVV self-hosted only)
		// filter reduce to matches we are hosting
		let homeGames = allMatches.filter((match) => match.host?.club?.includes("VC Müllheim"));
		// sort by date
		let homeGamesSorted = homeGames.sort((b, a) => Number(a.dateIso) - Number(b.dateIso));
		// count unique combination of date, location, league
		let uniqueHosts: string[] = [];
		homeGamesSorted.forEach((match) => {
			const dateLocationCombi: string = match.date + match.matchSeries.name + match.location?.id; // this is used below and needs to be identical!
			if (!uniqueHosts.includes(dateLocationCombi) && uniqueHosts.length < MAX_GAMES) {
				if (uniqueHosts.length < MIN_GAMES || match.dateObject <= todayPlusRange) {
					uniqueHosts.push(dateLocationCombi);
				}
			}
		});
		let homeGamesReduced = homeGamesSorted.filter((match) => uniqueHosts.includes(match.date + match.matchSeries.name + match.location?.id)); // this includes condition needs to be identical to the above "dateLocationCombi"
		matchesToDisplay = homeGamesReduced;

		// LOOP COUNTER
		loopCount = loopCount + 1;
	}

	// if there is at least one home game, display the matches
	if (eventsToDisplay.length >= 1 || matchesToDisplay.length >= 1) {
		// arrays to sort and fill throghout the following process
		let matchBuffer: string[] = [];
		return (
			<section className="col-full-content grid grid-cols-main-grid section-bg-gradient after:opacity-95">
				<a
					id="heimspiele"
					className="scroll-anchor"
				></a>
				<ExportedImage
					width={948}
					height={639}
					alt=""
					loading="lazy"
					src="/images/backgrounds/pageheading.jpg"
					className="absolute w-full h-full z-[-10] object-cover"
				/>
				<div className="col-center-content py-8 sm:py-12">
					{/* HEADING */}
					<h2 className="text-center md:text-left text-white font-bold text-3xl">{eventsToDisplay.length < 1 ? "Wir laden ein zum Heimspiel!" : "bevorstehende Veranstaltugnen"}</h2>
					{/* EVENTS */}
					{eventsToDisplay.length > 0 && (
						<>
							<div className="col-center-content columns-1 sm:has-[>:nth-of-type(2)]:columns-2 md:columns-2 lg:has-[>:nth-of-type(5)]:columns-3 gap-4 mt-3">
								{eventsToDisplay.map((event) => (
									<HeimspieleEvents
										{...event}
										key={event.title + event.start}
									/>
								))}
							</div>
						</>
					)}
					{/* MATCHES */}
					{matchesToDisplay.length > 0 && (
						<>
							<p className="text-center md:text-left text-balance text-white py-2">In den kommenden Tagen spielen wir in Müllheim und freuen uns über jeden Zuschauer!</p>
							<div className="col-center-content columns-1 sm:has-[>:nth-of-type(2)]:columns-2 md:columns-2 lg:has-[>:nth-of-type(5)]:columns-3 gap-4 mt-3">
								{matchesToDisplay.map((match) => {
									// group games together
									const dateLocationCombi: string = "dlc" + match.date + match.location?.id; // this is used to group games together
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
													<time
														dateTime={match.dateIso}
														className="text-lion mr-1"
													>
														{match.date}
													</time>
													<Link
														href={
															"https://www.google.com/maps/search/?api=1&query=" + match.location?.street + "," + match.location?.postalCode + "," + match.location?.city + "," + match.location?.name
														}
														target="_blank"
														rel="noopener noreferrer"
														className="text-turquoise"
													>
														<IconLocation className="inline align-baseline" />
														{match.location?.name}
														<span className="hidden xl:inline">, {match.location?.street}</span>
													</Link>

													{/* dateTimeLeagueLocationCombi */}
													{matchesToDisplay.map((matchLeagueTime) => {
														const dateTimeLeagueLocationCombi: string = "dtllc" + match.date + matchLeagueTime.time + matchLeagueTime.matchSeries?.name + match.location?.name; // this is used to group games
														const groupFilterTwo = groupFilterOne && !matchBuffer.includes(dateTimeLeagueLocationCombi);
														if (groupFilterTwo && match.date == matchLeagueTime.date && match.location?.id == matchLeagueTime.location?.id) {
															matchBuffer.push(dateTimeLeagueLocationCombi); // this groups games together if date and location match
															return (
																<Fragment key="League Name and Time">
																	{/* League Name and Time */}
																	<p className="font-bold flex gap-1">
																		<span>{matchLeagueTime.matchSeries?.name?.replace("Nord", "").replace("Ost", "").replace("Süd", "").replace("West", "")}</span>
																		<span>ab {matchLeagueTime.time} Uhr</span>
																	</p>
																	{/* fetch the guest for this date, time, league and location combination */}
																	<ul>
																		{matchesToDisplay.map((matchGuest) => {
																			if (
																				matchLeagueTime.location?.id == matchGuest.location?.id &&
																				match.date == matchGuest.date &&
																				matchLeagueTime.matchSeries?.uuid == matchGuest.matchSeries?.uuid
																			) {
																				return (
																					<Fragment key="Guests">
																						{matchGuest.team?.map((teamGuest) => {
																							if (teamGuest.id != matchGuest.host?.id && !matchBuffer.includes(teamGuest.id + dateLocationCombi)) {
																								matchBuffer.push(teamGuest.id + dateLocationCombi);
																								return (
																									<li
																										key={teamGuest.id}
																										className="pl-4 opacity-75"
																									>
																										{teamGuest.name}
																										{matchGuest.team?.map((teamCheckTwo, index, array) => {
																											if (array[0].club?.name == matchGuest.host?.club && array[1].club?.name == matchGuest.host?.club && teamCheckTwo.name != matchGuest.host?.club) {
																												if (teamCheckTwo.name == matchGuest.host?.name) {
																													return <Fragment key="club internal match">{" : " + teamCheckTwo.name}</Fragment>;
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
									<Link
										href="termine"
										className="gap-1 font-bold group"
									>
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
	} else {
		// check how many matches we have in total
		const allMatchesCount = cachedGetMatches(cachedGetTeamIds("id"), "future").length;
		// check how many events we have in total
		const allEventsCount = getEvents(0, 365).length;
		// prepare to display them as words
		const numToWordsDe = require("num-words-de");
		let allMatchesCountWord = numToWordsDe.numToWord(allMatchesCount, { uppercase: true });
		if (allMatchesCount > 12) {
			allMatchesCountWord = allMatchesCount; // shows higher numbers as integer
		}
		let allEventsCountWord = numToWordsDe.numToWord(allEventsCount, { uppercase: true });
		if (allEventsCount > 12) {
			allEventsCountWord = allEventsCount; // shows higher numbers as integer
		}
		return (
			<section className="col-full-content grid grid-cols-main-grid section-bg-gradient after:opacity-95">
				<a
					id="heimspiele"
					className="scroll-anchor"
				></a>
				<ExportedImage
					width={948}
					height={639}
					alt=""
					loading="lazy"
					src="/images/backgrounds/pageheading.jpg"
					className="absolute w-full h-full z-[-10] object-cover"
				/>
				<div className="col-center-content py-8 sm:py-12">
					<h2 className="text-center md:text-left text-white font-bold text-3xl">
						{allEventsCount >= 1 && allMatchesCount == 0 && "Zunächst keine Veranstaltungen"}
						{allEventsCount == 0 && allMatchesCount == 0 && "Zunächst keine Heimspiele"}
					</h2>
					<p className="text-center md:text-left text-white py-2 text-balance">
						In den kommenden {numToWordsDe.numToWord(((TIME_RANGE * TIME_RANGE_MAX_MULTIPLIER) / 7).toFixed(0), { uppercase: false })} Wochen stehen keine
						{allEventsCount >= 1 && allMatchesCount == 0 ? " Veranstaltungen " : " Spiele in Müllheim "}
						an.
						{allEventsCount >= 1 && allMatchesCount == 0 && (
							<span className="ml-1 sm:ml-0 sm:block *:inline *:align-text-center">
								{allEventsCount == 1 ? "Einen weiteren Termin zu einem späteren Zeitpunkt findest du" : allEventsCountWord + " weitere Termine zu einem späteren Zeitpunkt findest du"}
								<IconRight className="animate-pulse text-sm mb-1" />
								<IconRight className="-ml-2.5 animate-pulse mb-1" />
								<Link
									href="termine"
									className="gap-1 font-bold group"
								>
									hier
								</Link>
								<IconLeft className="-mr-2.5 animate-pulse mb-1" />
								<IconLeft className="animate-pulse text-sm mb-1" />
							</span>
						)}
						{allMatchesCount >= 1 && (
							<p className="text-center md:text-left mt-3 text-white  text-balance">
								Auswärtsspiele findest du im Spielplan der jeweiligen Mannschaft.
								<span className="ml-1 sm:ml-0 sm:block *:inline *:align-text-center">
									{allMatchesCount == 1 ? "Einen weiteren Termin findest du" : allMatchesCountWord + " weitere Termine unserer Mannschaften findest du"}
									<IconRight className="animate-pulse text-sm mb-1" />
									<IconRight className="-ml-2.5 animate-pulse mb-1" />
									<Link
										href="termine"
										className="gap-1 font-bold group"
									>
										hier
									</Link>
									<IconLeft className="-mr-2.5 animate-pulse mb-1" />
									<IconLeft className="animate-pulse text-sm mb-1" />
								</span>
							</p>
						)}
					</p>
				</div>
			</section>
		);
	}
}

// tests
function testMinRange() {
	if (Number(((TIME_RANGE * TIME_RANGE_MAX_MULTIPLIER) / 7).toFixed(0)) < 2) {
		throw "Time range for Home Games too short. Min 2 weeks required or else the number as word display is messed up. (Also it makes no sense to have it such a short range).";
	}
}
