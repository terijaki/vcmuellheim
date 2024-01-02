import PageHeading from "@/app/components/layout/PageHeading";
import MembersCard from "@/app/components/ui/MemberCard";
import Matches from "@/app/components/sams/Matches";
import Link from "next/link";
import { Fragment } from "react";
import { getMembers } from "@/app/utils/getMembers";
import { getTeams } from "@/app/utils/getTeams";
import { getLeagueName, getUniqueMatchSeriesIds } from "@/app/utils/samsJsonClubData";
import { FaUser as IconPerson, FaUserGroup as IconPersons, FaClock as IconClock, FaArrowsRotate as IconSubscribe } from "react-icons/fa6";
import { getRankings } from "@/app/utils/samsJsonRanking";
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
	const teams = getTeams(undefined, params.slug);
	const team = teams[0]; // removes the array and just returns the team object
	// get the name of the league from the club data
	let ligaName = getLeagueName(team.sbvvId);
	// ICS file generation
	team.sbvvId && icsTeamGeneration([team.sbvvId], params.slug);
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
				{team.sbvvId && (
					<>
						<div className="card-narrow lg:card pt-4">
							<h2 className="card-heading px-6">Ergebnisse</h2>
							{/* TODO deal with the fact that there might not be any past matches, e.g season start */}
							<Matches
								filter="past"
								teamId={[team.sbvvId]}
							/>
						</div>
						<div className="card-narrow lg:card pt-4">
							<h2 className="card-heading px-6">Spielplan</h2>
							<p className="p-4 pb-0 text-pretty">
								<Link
									href={"webcal://" + env.BASE_URL + "/ics/" + params.slug + ".ics"}
									className="gap-1 hyperlink group"
								>
									<IconSubscribe className="inline align-baseline group-hover:animate-spin" /> Abboniere unseren Kalender
								</Link>
								, um neue Termine saisonübergreifend automatisch in deiner Kalender-App zu empfangen.
							</p>
							{/* TODO deal with the fact that there might not be any future matches, e.g season end */}
							<Matches
								filter="future"
								teamId={[team.sbvvId]}
							/>
						</div>
					</>
				)}
				{/* ranking */}
				{team.sbvvId &&
					getRankings(getUniqueMatchSeriesIds([team.sbvvId.toString()])).map((ranking) => {
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
						<div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(160px,max-content))] md:grid-cols-[repeat(auto-fit,minmax(250px,max-content))]">
							{team.trainer?.map((trainer) => {
								// check if this trainer is in the member list and has an avatar
								const trainerList = getMembers("trainers");
								const filteredTrainers = trainerList.filter((thisTrainer) => thisTrainer.name == trainer.name);
								return (
									<div key="trainercard">
										{filteredTrainers[0] && filteredTrainers[0].avatar ? (
											<MembersCard
												name={trainer.name}
												avatar={filteredTrainers[0].avatar}
												email={trainer.email}
											/>
										) : (
											trainer.name
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
