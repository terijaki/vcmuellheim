import { cachedGetMatches } from "@/app/utils/sams/cachedGetMatches";
import { FaLocationDot as IconLocation, FaSquarePollVertical as IconResult } from "react-icons/fa6";
import Link from "next/link";

export default function Matches(props: { teamId: (number | string)[]; filter?: "future" | "past"; limit?: number }) {
	const teamIdString = props.teamId.map(String); // allows the teamId input to be string or number regardlessly
	const matches = cachedGetMatches(teamIdString, props.filter);
	// optional limiting the results
	if (props.limit) {
		matches.splice(props.limit);
	}
	// define how dates should be displayed
	const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" });
	// structure the last update date
	let dateDisplay;
	if (matches[0].matchSeries?.updated) {
		const dateInput = new Date(matches[0].matchSeries?.updated);
		dateDisplay = dateFormat.format(dateInput).toString() + " Uhr";
	}
	if (props.filter == "past") {
		return (
			<div key="past matches">
				<p
					className="text-right text-sm italic text-gray-400 py-1 px-3"
					data-match-type="past"
				>
					Stand: <time dateTime={matches[0].matchSeries?.updated}>{dateDisplay}</time>
				</p>
				{matches.map((match) => {
					return (
						<div
							className={
								"grid grid-flow-row sm:grid-cols-[max-content,minmax(auto,1fr),max-content] md:grid-cols-[1fr,4fr,2fr] gap-x-4 items-center px-4 py-2 text-onyx" +
								(matches.length % 2 ? " odd:bg-black/5" : " even:bg-black/5")
							}
							key={match.uuid}
						>
							<div className="sm:text-center text-sm pt-1 sm:py-1">
								{match.date ? (
									<time
										className="mr-1 sm:block"
										dateTime={match.dateIso}
									>
										{match.date}
									</time>
								) : (
									""
								)}
								{match.location && match.location.city && match.location.postalCode && match.location.street && match.location.name ? (
									<Link
										href={"https://www.google.com/maps/search/?api=1&query=" + match.location.street + "," + match.location.postalCode + "," + match.location.city + "," + match.location.name}
										className="text-gray-600 line-clamp-1 break-all text-xs inline-flex items-baseline"
										target="_blank"
										rel="noopener noreferrer"
									>
										<IconLocation className="inline text-xs" />
										{match.location.city.split("-")[0]}
									</Link>
								) : (
									""
								)}
							</div>
							<div
								className="font-bold"
								key="team"
							>
								{match.team?.map((team, index) => {
									return (
										<p
											className="md:inline"
											key={team.id}
											data-team-id={team.id}
											data-team-name={team.name}
										>
											{index > 0 && <span className="hidden md:inline mx-1">:</span>}
											{team.name}
										</p>
									);
								})}
								{match.matchSeries?.name && <p className="text-lion font-thin text-sm md:text-base whitespace-nowrap line-clamp-1 break-all">{match.matchSeries?.name}</p>}
							</div>
							<div className="pb-1 sm:py-1 mr-3 sm:mr-0 inline-flex items-center">
								{match.team?.map((team, index) => {
									if (match.results && match.results.winner == (index + 1).toString() && team.id && teamIdString.includes(team.id)) {
										return (
											<IconResult
												className="inline text-turquoise mr-1"
												key={team}
											/>
										);
									} else if (match.results && match.results.winner == (index + 2).toString() && team.id && teamIdString.includes(team.id)) {
										return (
											<IconResult
												className="inline text-turquoise mr-1"
												key={team}
											/>
										);
									} else if (team.id && teamIdString.includes(team.id)) {
										return (
											<IconResult
												className="inline mr-1"
												key={team}
											/>
										);
									}
								})}
								{match.results?.setPoints}
								{match.results &&
									match.results.sets &&
									match.results.sets.set &&
									match.results.sets.set.map((set) => {
										return (
											<span
												className="text-xs mt-1 sm:mt-0.5 first-of-type:ml-2 before:content-[','] first-of-type:before:content-['('] last-of-type:after:content-[')'] row-start-2"
												key="setPoints"
											>
												{set.points}
											</span>
										);
									})}
							</div>
						</div>
					);
				})}
			</div>
		);
	}
	if (props.filter == "future") {
		return (
			<div key="future matches">
				<p
					className="text-right text-sm italic text-gray-400 py-1 px-3"
					data-match-type="future"
				>
					Stand: {dateDisplay}
				</p>
				{matches.map((match) => {
					return (
						<div
							className={"grid grid-flow-row sm:grid-cols-[auto,minmax(auto,1fr),auto] gap-x-4 items-center px-4 text-onyx " + (matches.length % 2 ? " odd:bg-black/5" : " even:bg-black/5")}
							key={match.uuid}
						>
							<div className="sm:text-center text-sm pt-1 sm:py-1">
								{match.date ? (
									<time
										className="mr-1 sm:block"
										dateTime={match.dateIso}
									>
										{match.date}
									</time>
								) : (
									""
								)}
								{match.time && Number(match.time.slice(0, 2)) > 0 ? match.time + " Uhr" : ""}
							</div>
							<div
								className="py-1 font-bold"
								key="team"
							>
								{match.team?.map((team, index) => {
									if (team.id && (teamIdString.length > 1 || !teamIdString.includes(team.id))) {
										return (
											<p
												className="whitespace-nowrap line-clamp-1 break-before-all lg:inline"
												key={team.name}
												data-team-id={team.id}
												data-team-name={team.name}
											>
												{index > 0 && <span className="hidden lg:inline mx-1">:</span>}
												{team.name}
											</p>
										);
									}
								})}
								{match.matchSeries?.name && <p className="text-lion font-thin text-sm md:text-base whitespace-nowrap line-clamp-1 break-all">{match.matchSeries?.name}</p>}
							</div>
							<div className="pb-1 sm:py-1 mr-3 sm:mr-0">
								{match.location && match.location.city && match.location.postalCode && match.location.street && match.location.name ? (
									<Link
										href={"https://www.google.com/maps/search/?api=1&query=" + match.location.street + "," + match.location.postalCode + "," + match.location.city + "," + match.location.name}
										className="hyperlink line-clamp-1 break-all text-sm md:text-base inline-flex items-center sd:items-baseline"
										target="_blank"
										rel="noopener noreferrer"
									>
										<IconLocation className="inline" />
										{match.location.city} <span className="text-sm md:text-base ml-1"> ({match.location.street.replace("straße", "str.").replace("strasse", "str.")})</span>
									</Link>
								) : (
									""
								)}
							</div>
						</div>
					);
				})}
			</div>
		);
	}
}
