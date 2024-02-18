import React, { Fragment } from "react";
import { rankingsArray } from "@/app/utils/sams/cachedGetRanking";
import { cachedGetTeamIds } from "@/app/utils/sams/cachedGetClubData";
import ClubLogo from "./ClubLogo";

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
				<div className="grid grid-cols-[repeat(4,auto)] sm:grid-cols-[repeat(5,auto)] md:grid-cols-[repeat(4,auto)] lg:grid-cols-[repeat(5,auto)] relative overflow-hidden">
					<div className="font-bold text-slate-600 text-center mr-1 sm:hidden">Nr</div>
					<div className="font-bold text-slate-600 text-center mr-1 hidden sm:block">Platz</div>
					<div className="font-bold text-slate-600 mr-1">Mannschaft</div>
					<div className="font-bold text-slate-600 text-center mr-1">Siege</div>
					<div className="font-bold text-slate-600 text-center mr-1 hidden sm:block md:hidden lg:block">Sätze</div>
					<div className="font-bold text-slate-600 text-center mr-1 hidden lg:block">Punkte</div>
					<div className="font-bold text-slate-600 text-center lg:hidden">Pkt</div>
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
										className="mr-1"
									/>
									{team.team.name}
								</div>
								<div
									data-team-id={team.team.id}
									data-team-name={team.team.name}
									className={"flex justify-center items-center text-sm sm:text-base md:text-sm lg:text-base gap-1.5" + " " + (clubTeamIds.includes(team.team.id) && "bg-onyx text-white")}
								>
									{team.wins}/{team.matchesPlayed}
									<p className="text-xs sm:hidden md:inline lg:hidden italic opacity-50">{team.setPoints}</p>
								</div>
								<div
									data-team-id={team.team.id}
									data-team-name={team.team.name}
									className={"justify-center items-center text-xs hidden sm:flex md:hidden lg:flex" + " " + (clubTeamIds.includes(team.team.id) && "bg-onyx text-white")}
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
