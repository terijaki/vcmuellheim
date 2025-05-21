import type { samsClubData } from "@/utils/sams/sams-server-actions";
import dayjs from "dayjs";
import { Suspense } from "react";
import type { Rankings } from "sams-rpc";
import ClubLogo, { ClubLogoFallback } from "./ClubLogo";

type RankingTable = Rankings & {
	linkToTeamPage?: boolean;
	clubData?: Awaited<ReturnType<typeof samsClubData>>;
};

export default function RankingTable(props: RankingTable) {
	const ranking = props.ranking;

	if (!ranking) return null;

	return (
		<div className="card-narrow">
			<h2 className="card-heading">{props.matchSeries.name}</h2>
			<ul className="grid grid-cols-2 text-xs text-lion italic w-full my-2 px-6">
				<li>Saison {props.matchSeries.season.name}</li>
				{props.matchSeries.updated && <LastUpdate date={props.matchSeries.updated} />}
			</ul>

			<Suspense
				fallback={
					<div>
						<div className="p-3 bg-onyx/5 animate-pulse" />
						<div className="p-3" />
						<div className="p-3 bg-onyx/5 animate-pulse" />
						<div className="p-3" />
					</div>
				}
			>
				<div className="tabelle pb-3">
					<table className="w-full prose-td:px-2 prose-td:h-full prise-td:items-center">
						<thead className="font-bold text-slate-600 *:text-center">
							<tr>
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
							</tr>
						</thead>
						<tbody>
							{ranking.map(async (team) => {
								const clubName = team.team.club;
								const isClubTeam = props.clubData?.id === team.team.id || false;

								return (
									<>
										<tr
											key={team.team.id}
											className={`hover:bg-blumine hover:text-white ${ranking.length % 2 === 0 ? "even:bg-black/5" : "odd:bg-black/5"}${isClubTeam ? " odd:bg-onyx even:bg-onyx text-white" : ""}`}
											data-team-id={team.team.id}
											data-team-name={team.team.name}
										>
											<td className="text-center justify-center items-center">{team.place}</td>
											<td className="truncate justify-left items-center p-0.5 w-full h-full">
												{/* //TODO link to team page if its a club team
												{isClubTeam && props.linkToTeamPage && getTeams(team.team.id).length === 1 ? (
													<Link
														href={`teams/${getTeams(team.team.id)[0].slug}`} 
														className="w-full flex justify-start items-center"
													>
														<ClubLogo
															clubName={clubName}
															logo={clubLogo}
															className={`mr-1 ${isClubTeam && "saturate-0 brightness-0 invert"}`}
														/>
														<div>{team.team.name}</div>
													</Link>
												) : (
													<div className="w-full flex justify-start items-center">
														<ClubLogo
															clubName={clubName}
															logo={clubLogo}
															className={`mr-1 ${isClubTeam && "saturate-0 brightness-0 invert"}`}
														/>
														<div>{team.team.name}</div>
													</div>
												)} */}
												<div className="w-full flex justify-start items-center">
													<Suspense fallback={<ClubLogoFallback className="mr-1" />}>
														<ClubLogo
															clubName={clubName}
															className={`mr-1 ${isClubTeam && "saturate-0 brightness-0 invert"}`}
														/>
													</Suspense>
													<div>{team.team.name}</div>
												</div>
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
						</tbody>
					</table>
				</div>
			</Suspense>
		</div>
	);
}

function LastUpdate({ date }: { date: string }) {
	const dateInput = dayjs(date);
	const dateDisplay = dateInput.format("DD.MM.YY");
	const dateTimeDisplay = dateInput.format("HH:mm");

	return (
		<p className="text-xs text-gray-400 text-end">
			Stand <time dateTime={date.toString()}>{dateDisplay}</time> {dateTimeDisplay} Uhr
		</p>
	);
}
