import { cachedGetTeamIds } from "@/app/utils/sams/cachedGetClubData";
import { cachedGetMatches } from "@/app/utils/sams/cachedGetMatches";
import ExportedImage from "next-image-export-optimizer";
import Link from "next/link";
import { Fragment } from "react";
import { FaLocationDot as IconLocation, FaAngleRight as IconRight, FaAngleLeft as IconLeft } from "react-icons/fa6";

const TIME_RANGE: number = 7 * 4; // controls the display matches taking place # days in the future

//TODO: redo the filtering. it needs to be filtered way sooner and predictable before the return not while returning. maybe get the amount of dlc beforehand
export default function HomeHeimspiele() {
	testMinRange();
	// construct the cut off date. dates after this value are excluded
	const todayPlusRange = new Date();
	todayPlusRange.setDate(todayPlusRange.getDate() + TIME_RANGE);
	// get the matches
	const homeGames = cachedGetMatches(cachedGetTeamIds("id"), "future");
	// filter out the matches that do not qualify based on their date
	let homeGamesFiltered = homeGames.filter((match) => match.dateObject > new Date() && match.host?.club?.includes("VC Müllheim"));

	if (homeGamesFiltered.length > 4) {
		// if more than two games then use todayPlusRange filter
		homeGamesFiltered.filter((match) => match.dateObject > new Date() && match.dateObject < todayPlusRange && match.host?.club?.includes("VC Müllheim"));
	}

	// if there is at least one home game
	if (homeGamesFiltered.length >= 1) {
		// arrays to sort and fill throghout the following process
		let matchBuffer: string[] = [];
		let matchCountBuffer: number = 0;
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
					<h2 className="text-center md:text-left text-white font-bold text-3xl">Wir laden ein zum Heimspiel!</h2>
					<p className="text-center md:text-left text-balance text-white py-2">In den kommenden Tagen spielen wir in Müllheim und freuen uns über jeden Zuschauer!</p>
					<div className="col-center-content columns-1 sm:has-[>:nth-of-type(2)]:columns-2 md:columns-2 lg:has-[>:nth-of-type(5)]:columns-3 gap-4 mt-3">
						{homeGamesFiltered.map((match) => {
							// consider this match if its taking place in the future and is within the specified TIME_RANGE

							const dateLocationCombi: string = "dlc" + match.date + match.location?.id; // this is used to group games together
							const filterLevel1 = !matchBuffer.includes(match.uuid) && !matchBuffer.includes(dateLocationCombi) && matchCountBuffer < 555;

							if (filterLevel1) {
								matchBuffer.push(match.uuid); // makes sure the specific match is already rendered, this avoids duplicates if two of our teams play against each other
								matchBuffer.push(dateLocationCombi); // this groups games together if date and location match
								matchCountBuffer = matchCountBuffer + 1;
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
												href={"https://www.google.com/maps/search/?api=1&query=" + match.location?.street + "," + match.location?.postalCode + "," + match.location?.city + "," + match.location?.name}
												target="_blank"
												rel="noopener noreferrer"
												className="text-turquoise"
											>
												<IconLocation className="inline align-baseline" />
												{match.location?.name}
												<span className="hidden xl:inline">, {match.location?.street}</span>
											</Link>

											{/* dateTimeLeagueLocationCombi */}
											{homeGamesFiltered.map((matchLeagueTime) => {
												const dateTimeLeagueLocationCombi: string = "dtllc" + match.date + matchLeagueTime.time + matchLeagueTime.matchSeries?.name + match.location?.name; // this is used to group games
												const filterLevel3 = filterLevel1 && !matchBuffer.includes(dateTimeLeagueLocationCombi);
												if (filterLevel3 && match.date == matchLeagueTime.date && match.location?.id == matchLeagueTime.location?.id) {
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
																{homeGamesFiltered.map((matchGuest) => {
																	if (matchLeagueTime.location?.id == matchGuest.location?.id && match.date == matchGuest.date && matchLeagueTime.matchSeries?.uuid == matchGuest.matchSeries?.uuid) {
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
				</div>
			</section>
		);
	} else {
		// check how many matches we have in total
		const allMatchesCount = cachedGetMatches(cachedGetTeamIds("id"), "future").length;
		// prepare to display them as words
		const numToWordsDe = require("num-words-de");
		let allMatchesCountWord = numToWordsDe.numToWord(allMatchesCount, { uppercase: true });
		if (allMatchesCount > 12) {
			allMatchesCountWord = allMatchesCount; // shows higher numbers as integer
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
					<h2 className="text-center md:text-left text-white font-bold text-3xl">Zunächst keine Heimspiele</h2>
					<p className="text-center md:text-left text-white py-2 text-balance">
						In den kommenden {numToWordsDe.numToWord((TIME_RANGE / 7).toFixed(0), { uppercase: false })} Wochen stehen keine Spiele in Müllheim an.
					</p>

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
				</div>
			</section>
		);
	}
}

// tests
function testMinRange() {
	if (Number((TIME_RANGE / 7).toFixed(0)) < 2) {
		throw "Time range for Home Games too short. Min 2 weeks required or else the number as word display is messed up. (Also it makes no sense to have it such a short range).";
	}
}
