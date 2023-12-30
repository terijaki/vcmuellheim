import { getTeamIds } from "@/app/utils/samsClubData";
import { getMatches } from "@/app/utils/samsMatches";
import ExportedImage from "next-image-export-optimizer";
import Link from "next/link";
import { Fragment } from "react";
import { FaLocationDot as IconLocation, FaAngleRight as IconRight, FaAngleLeft as IconLeft } from "react-icons/fa6";

export default function HomeHeimspiele() {
	let matchBuffer: string[] = [];
	let matchCountBuffer: number = 0;
	return (
		<section
			id="heimspiele"
			className="col-full-content grid grid-cols-main-grid section-bg-gradient after:opacity-95"
		>
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
				<p className="text-center md:text-left text-white py-2">In den kommenden Tagen spielen wir in Müllheim und freuen uns über jeden Zuschauer!</p>
				<div className="col-center-content columns-1 sm:columns-2 lg:columns-3 gap-4 mt-3">
					{getMatches(getTeamIds("id"), "future").map((match) => {
						const dateLocationCombi: string = "dlc" + match.date + match.location?.id; // this is used to group games together
						const filterLevel1 = !matchBuffer.includes(match.uuid) && match.host?.club?.includes("VC Müllheim");
						const filterLevel2 = filterLevel1 && !matchBuffer.includes(dateLocationCombi) && matchCountBuffer < 555;

						if (filterLevel2) {
							matchBuffer.push(match.uuid); // makes sure the specific match is already rendered, this avoids duplicates if two of our teams play against each other
							matchBuffer.push(dateLocationCombi); // this groups games together if date and location match
							matchCountBuffer = matchCountBuffer + 1;
							return (
								<div
									className="card bg-onyx text-white inline-block w-full break-inside-avoid mb-3"
									key={match.uuid}
								>
									<div>
										<span className="text-lion mr-1">{match.date}</span>
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
										{getMatches(getTeamIds("id"), "future").map((matchLeagueTime) => {
											const dateTimeLeagueLocationCombi: string = "dtllc" + match.date + matchLeagueTime.time + matchLeagueTime.matchSeries?.name + match.location?.name; // this is used to group games
											const filterLevel3 = filterLevel2 && !matchBuffer.includes(dateTimeLeagueLocationCombi);
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
															{getMatches(getTeamIds("id"), "future").map((matchGuest) => {
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
				<p className="mt-3 text-white text-pretty">
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
}
