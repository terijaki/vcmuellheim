import React, { Fragment } from "react";
import { rankingsArray } from "@/app/utils/sams/cachedGetRanking";
import { cachedGetTeamIds } from "@/app/utils/sams/cachedGetClubData";
import ClubLogo from "./ClubLogo";
import Link from "next/link";
import { getTeams } from "@/app/utils/getTeams";

export default function RankingTable(props: rankingsArray) {
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
				<table className="w-full">
					<thead className="font-bold text-slate-600">
						<td className="text-center mr-1">
							<span className="">Nr</span>
							<span className="hidden">Platz</span>
						</td>
						<td className="mr-1">Mannschaft</td>
						<td className="text-center mr-1">Siege</td>
						<td className="text-center mr-1 hidden sm:block">Sätze</td>
						<td className="text-center mr-1">
							<span className="">Punkte</span>
							<span className="hidden">PlaPkttz</span>
						</td>
					</thead>
					{props.ranking.map(async (team: any) => {
						console.log(props.ranking.length % 2);
						return (
							<>
								<tr
									key={team.team.id}
									className={
										(props.ranking.length % 2 == 1 ? "even:bg-black/5" : "odd:bg-black/5") +
										" hover:bg-blumine hover:text-white " +
										(clubTeamIds.includes(team.team.id) && " odd:bg-onyx even:bg-onyx text-white")
									}
								>
									<td
										data-team-id={team.team.id}
										data-team-name={team.team.name}
										className="text-center justify-center items-center"
									>
										{team.place}
									</td>
									<td
										data-team-id={team.team.id}
										data-team-name={team.team.name}
										className="items-center truncate p-0.5 inline-flex w-full"
									>
										{clubTeamIds.includes(team.team.id) && props.linkToTeamPage ? (
											<Link
												href={"teams/" + getTeams(team.team.id)[0].slug}
												className="w-full"
											>
												<ClubLogo
													clubName={team.team.club.name}
													className={"mr-1 " + (clubTeamIds.includes(team.team.id) && "saturate-0 brightness-0 invert")}
												/>
												{team.team.name}
											</Link>
										) : (
											<>
												<ClubLogo
													clubName={team.team.club.name}
													className={"mr-1 " + (clubTeamIds.includes(team.team.id) && "saturate-0 brightness-0 invert")}
												/>
												{team.team.name}
											</>
										)}
									</td>
									<td
										data-team-id={team.team.id}
										data-team-name={team.team.name}
										className="text-center text-sm gap-1.5"
									>
										{team.wins}/{team.matchesPlayed}
										<p className="text-xs sm:hidden italic opacity-50">{team.setPoints}</p>
									</td>
									<td
										data-team-id={team.team.id}
										data-team-name={team.team.name}
										className="text-xs hidden sm:inline-flex w-full justify-center"
									>
										{team.setPoints}
									</td>
									<td
										data-team-id={team.team.id}
										data-team-name={team.team.name}
										className="text-center text-sm"
									>
										{team.points}
									</td>
								</tr>
							</>
						);
					})}
				</table>
			</div>

			<div className="tabelle pb-3 hidden">
				<div className="grid grid-cols-[repeat(4,auto)] sm:grid-cols-[repeat(5,auto)] relative overflow-hidden">
					<div className="font-bold text-slate-600 text-center mr-1 sm:hidden">Nr</div>
					<div className="font-bold text-slate-600 text-center mr-1 hidden sm:block">Platz</div>
					<div className="font-bold text-slate-600 mr-1">Mannschaft</div>
					<div className="font-bold text-slate-600 text-center mr-1">Siege</div>
					<div className="font-bold text-slate-600 text-center mr-1 hidden sm:block">Sätze</div>
					<div className="font-bold text-slate-600 text-center mr-1 hidden sm:block">Punkte</div>
					<div className="font-bold text-slate-600 text-center sm:hidden">Pkt</div>
					{props.ranking.map(async (team: any) => {
						return (
							<Fragment key={team.team.id}>
								<div
									data-team-id={team.team.id}
									data-team-name={team.team.name}
									className={"flex justify-center items-center" + " " + (clubTeamIds.includes(team.team.id) && "bg-onyx text-white")}
								>
									{team.place}
								</div>
								<div
									data-team-id={team.team.id}
									data-team-name={team.team.name}
									className={"flex items-center truncate p-0.5" + " " + (clubTeamIds.includes(team.team.id) && "bg-onyx text-white")}
								>
									<ClubLogo
										clubName={team.team.club.name}
										className={"mr-1 " + (clubTeamIds.includes(team.team.id) && "saturate-0 brightness-0 invert")}
									/>
									{team.team.name}
								</div>
								<div
									data-team-id={team.team.id}
									data-team-name={team.team.name}
									className={"flex justify-center items-center text-sm gap-1.5" + " " + (clubTeamIds.includes(team.team.id) && "bg-onyx text-white")}
								>
									{team.wins}/{team.matchesPlayed}
									<p className="text-xs sm:hidden italic opacity-50">{team.setPoints}</p>
								</div>
								<div
									data-team-id={team.team.id}
									data-team-name={team.team.name}
									className={"justify-center items-center text-xs hidden sm:flex" + " " + (clubTeamIds.includes(team.team.id) && "bg-onyx text-white")}
								>
									{team.setPoints}
								</div>
								<div
									data-team-id={team.team.id}
									data-team-name={team.team.name}
									className={"flex justify-center items-center text-sm" + " " + (clubTeamIds.includes(team.team.id) && "bg-onyx text-white")}
								>
									{team.points}
								</div>
							</Fragment>
						);
					})}
				</div>
			</div>
		</div>
	);
}
