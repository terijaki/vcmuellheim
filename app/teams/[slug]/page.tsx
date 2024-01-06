import PageHeading from "@/app/components/layout/PageHeading";
import MembersCard from "@/app/components/ui/MemberCard";
import Matches from "@/app/components/sams/Matches";
import Link from "next/link";
import { Fragment } from "react";
import { getMembers } from "@/app/utils/getMembers";
import { getTeams } from "@/app/utils/getTeams";
import { getLeagueName, getUniqueMatchSeriesIds } from "@/app/utils/sams/jsonClubData";
import { FaUser as IconPerson, FaUserGroup as IconPersons, FaClock as IconClock, FaBullhorn as IconSubscribe } from "react-icons/fa6";
import { getRankings } from "@/app/utils/sams/jsonRanking";
import { getMatches } from "@/app/utils/sams/jsonMatches";
import RankingTable from "@/app/components/sams/RankingTable";
import { icsTeamGeneration } from "@/app/utils/icsGeneration";
import { env } from "process";

// generate static routes for each team slug
// example: http://localhost:3000/teams/herren1
export async function generateStaticParams() {
	const teams = getTeams();
	let slugList: string[] = [];

	teams.forEach((team) => {
		if (team.slug && team.sbvvId) {
			// herren1, damen2, etc. <-- file name of the team without the extension
			slugList.push(team.slug);
		}
	});
	return slugList.map((param) => ({
		slug: param,
	}));
}

export default function TeamPage({ params }: { params: { slug: string } }) {
	// pre-render setup
	// removes the array and just returns the team object
	const team = getTeams(undefined, params.slug)[0];
	if (team.sbvvId) {
		// get the name of the league from the club data
		let ligaName = getLeagueName(team.sbvvId);
		// initiate ICS file generation
		team.sbvvId && icsTeamGeneration([team.sbvvId], params.slug);
		// fetch the rankings
		const ranking = getRankings(getUniqueMatchSeriesIds([team.sbvvId]));
		// fetch the matches
		const matchesFuture = getMatches([team.sbvvId], "future");
		const matchesPast = getMatches([team.sbvvId], "past");
		// check if its currently a month outside of the season
		const currentMonth = new Date().getMonth() + 1;
		const seasonMonth = currentMonth >= 5 && currentMonth <= 9 ? true : false;
		// render the page
		return (
			<>
				{team.title && (
					<PageHeading
						title={team.title}
						subtitle={ligaName}
					/>
				)}

				<div className="col-full-content md:col-center-content *:mb-10 mt-6">
					{/* matches */}
					{matchesFuture.length + matchesPast.length > 0 ? (
						<>
							<div className="card lg:card">
								<h2 className="card-heading">Mannschaftskalender</h2>
								<p className="my-3 text-pretty">
									<Link
										href={"webcal://" + env.BASE_URL + "/ics/" + params.slug + ".ics"}
										className="gap-1 hyperlink group"
									>
										<IconSubscribe className="inline align-baseline" /> Abboniere unseren Kalender
									</Link>
									, um neue Termine saisonübergreifend automatisch in deiner Kalender-App zu empfangen.
								</p>
							</div>
							{matchesPast.length > 0 && (
								<div className="card-narrow lg:card">
									<h2 className="card-heading">Ergebnisse</h2>
									<Matches
										filter="past"
										teamId={[team.sbvvId]}
									/>
								</div>
							)}
							{matchesFuture.length > 0 ? (
								<div className="card-narrow lg:card">
									<h2 className="card-heading">Spielplan</h2>
									<Matches
										filter="future"
										teamId={[team.sbvvId]}
									/>
								</div>
							) : (
								<div className="card">
									<h2 className="card-heading">Spielplan</h2>
									<p>Aktuell konnten keine Spieltermine gefunden werden.</p>
									{!seasonMonth && <p>Die Saison im Hallenvolleyball findet in der Regel in den Monaten von September bis April statt.</p>}
								</div>
							)}
						</>
					) : (
						<div className="card lg:card">
							<h2 className="card-heading">Keine Spieltermine gefunden</h2>
							{seasonMonth && <p className="mb-6">Die Saison im Hallenvolleyball findet in der Regel in den Monaten von September bis April statt.</p>}

							<p className="my-3 text-pretty">
								<Link
									href={"webcal://" + env.BASE_URL + "/ics/" + params.slug + ".ics"}
									className="gap-1 hyperlink group"
								>
									<IconSubscribe className="inline align-baseline" /> Abboniere unseren Kalender
								</Link>
								, um neue Termine saisonübergreifend automatisch in deiner Kalender-App zu empfangen.
							</p>
						</div>
					)}
					{/* ranking */}
					{ranking.length > 0 &&
						ranking.map((ranking) => {
							return (
								<div key="tabelle">
									<RankingTable
										{...ranking}
										key={ranking.matchSeries.id}
										exclusive={team.sbvvId?.toString()}
									/>
								</div>
							);
						})}
					{/* team info */}
					<div className="card *:mb-3">
						<h2 className="card-heading">Team Infos</h2>
						{team.training && (
							<div className="leading-tight">
								<h3 className="font-bold flex gap-x-1 items-baseline">
									<IconClock className="text-xs" />
									Trainingszeiten:
								</h3>
								{team.training?.map((training) => {
									return (
										<Fragment key="trainingszeiten">
											<p>{training.zeit}</p>
											<Link
												href={"" + training.map}
												target="_blank"
												scroll={false}
												className="text-turquoise"
											>
												{training.ort}
											</Link>
										</Fragment>
									);
								})}
							</div>
						)}
						<div className="trainers">
							<h3 className="font-bold flex gap-x-1 items-baseline">
								{team.trainer?.length == 1 ? <IconPerson className="text-xs" /> : <IconPersons className="text-xs" />}
								Trainer:
							</h3>
							<div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(180px,max-content))] md:grid-cols-[repeat(auto-fit,minmax(250px,max-content))]">
								{team.trainer?.map((trainer) => {
									// check if this trainer is in the member list and has an avatar
									const trainerList = getMembers();
									const filteredTrainers = trainerList.filter((thisTrainer) => thisTrainer.name == trainer.name);
									return (
										<div key="trainercard">
											{filteredTrainers[0] && filteredTrainers[0].avatar ? (
												<MembersCard
													{...trainer}
													avatar={filteredTrainers[0].avatar}
												/>
											) : (
												<MembersCard {...trainer} />
											)}
										</div>
									);
								})}
							</div>
						</div>
					</div>

					<div className="text-center">
						<Link
							href="/#mannschaften"
							className="button"
						>
							zu den anderen Mannschaften
						</Link>
					</div>
				</div>
			</>
		);
	}
}
