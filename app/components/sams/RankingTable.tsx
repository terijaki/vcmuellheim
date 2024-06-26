import React from "react";
import { cachedGetTeamIds } from "@/app/utils/sams/cachedGetClubData";
import ClubLogo from "./ClubLogo";
import Link from "next/link";
import { getTeams } from "@/app/utils/getTeams";
import { Rankings } from "@/app/utils/sams/rankings";

type RankingTable = Rankings & {
	exclusive?: string | number;
	linkToTeamPage?: boolean;
};

export default function RankingTable(props: RankingTable) {
	// prepare date formatting
	const dateInput = new Date(props.matchSeries.updated);
	const dateFormat = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "2-digit", year: "2-digit" });
	const dateTimeFormat = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });
	const dateDisplay = dateFormat.format(dateInput).toString();
	const dateTimeDisplay = dateTimeFormat.format(dateInput).toString();
	// check club data to identify our team IDs
	let clubTeamIds: any[] = [];
	if (props.exclusive) {
		clubTeamIds.push(props.exclusive);
	} else {
		clubTeamIds = cachedGetTeamIds("id");
	}
	if (props.ranking) {
		return (
			<div className="card-narrow">
				<h2 className="card-heading">{props.matchSeries.name}</h2>
				<ul className="grid grid-cols-2 text-xs text-lion italic w-full my-2 px-6">
					<li>Saison {props.matchSeries.season.name}</li>
					<li className="text-xs text-gray-400 text-end">
						Stand {dateDisplay} {dateTimeDisplay} Uhr
					</li>
				</ul>

				<div className="tabelle pb-3">
					<table className="w-full prose-td:px-2 prose-td:h-full prise-td:items-center">
						<thead className="font-bold text-slate-600 *:text-center">
							<td>
								<span className="sm:hidden lg:inline xl:hidden">Nr</span>
								<span className="hidden sm:inline lg:hidden xl:inline">Platz</span>
							</td>
							<td className="!text-left">Mannschaft</td>
							<td>Siege</td>
							<td className="hidden sm:block">Sätze</td>
							<td>
								<span className="sm:hidden lg:inline xl:hidden">Pkt</span>
								<span className="hidden sm:inline lg:hidden xl:inline">Punkte</span>
							</td>
						</thead>
						{props.ranking.map(async (team: any) => {
							return (
								<>
									<tr
										key={team.team.id}
										className={
											"hover:bg-blumine hover:text-white " +
											(props.ranking.length % 2 == 0 ? "even:bg-black/5" : "odd:bg-black/5") +
											(clubTeamIds.includes(team.team.id) != false ? " odd:bg-onyx even:bg-onyx text-white" : "")
										}
										data-team-id={team.team.id}
										data-team-name={team.team.name}
									>
										<td className="text-center justify-center items-center">{team.place}</td>
										<td className="truncate justify-left items-center p-0.5 w-full h-full">
											{clubTeamIds.includes(team.team.id) && props.linkToTeamPage && getTeams(team.team.id).length == 1 ? (
												<Link
													href={"teams/" + getTeams(team.team.id)[0].slug}
													className="w-full flex justify-start items-center"
												>
													<ClubLogo
														clubName={team.team.club.name}
														className={"mr-1 " + (clubTeamIds.includes(team.team.id) && "saturate-0 brightness-0 invert")}
													/>
													<div>{team.team.name}</div>
												</Link>
											) : (
												<div className="w-full flex justify-start items-center">
													<ClubLogo
														clubName={team.team.club.name}
														className={"mr-1 " + (clubTeamIds.includes(team.team.id) && "saturate-0 brightness-0 invert")}
													/>
													<div>{team.team.name}</div>
												</div>
											)}
										</td>
										<td className="text-center text-sm gap-1.5 infline-flex">
											{team.wins}/{team.matchesPlayed}
											<p className="text-xs sm:hidden italic opacity-50">{team.setPoints}</p>
										</td>
										<td className="text-xs hidden sm:inline-flex w-full justify-center">{team.setPoints}</td>
										<td className="text-center text-sm">{team.points}</td>
									</tr>
								</>
							);
						})}
					</table>
				</div>
			</div>
		);
	}
}
