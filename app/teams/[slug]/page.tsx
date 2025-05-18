import PageHeading from "@/app/components/layout/PageHeading";
import Matches from "@/app/components/sams/Matches";
import RankingTable from "@/app/components/sams/RankingTable";
import MembersCard from "@/app/components/ui/MemberCard";
import { getMembers } from "@/app/utils/getMembers";
import { getTeams } from "@/app/utils/getTeams";
import { samsPlayers } from "@/app/utils/sams/players";
import { samsClubData, samsMatches, samsRanking, samsSeasons } from "@/app/utils/sams/sams-server-actions";
import { Club } from "@/project.config";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import {
	FaClock as IconClock,
	FaEnvelope as IconEmail,
	FaUser as IconPerson,
	FaUserGroup as IconPersons,
	FaBullhorn as IconSubscribe,
} from "react-icons/fa6";
import Flag from "react-world-flags";
import type { Match, Rankings } from "sams-rpc";

export default async function TeamPage(props: { params: Promise<{ slug: string }> }) {
	const params = await props.params;

	const team = (await getTeams(undefined, params.slug))[0];

	if (!team.sbvvId) return null;

	const clubData = await samsClubData();
	const teamData = clubData?.teams?.team.find((t) => t.id === team.sbvvId);
	const allSeasonMatchSeriesId = teamData?.matchSeries.allSeasonId;
	const leagueName = teamData?.matchSeries?.name;

	let ranking: Rankings | undefined = undefined;
	let futureMatches: Match[] | undefined = undefined;
	let pastMatches: Match[] | undefined = undefined;

	if (allSeasonMatchSeriesId) {
		ranking = await samsRanking({ allSeasonMatchSeriesId });
		futureMatches = await samsMatches({ allSeasonMatchSeriesId, future: true });
		pastMatches = await samsMatches({ allSeasonMatchSeriesId, past: true });
	}

	const seasons = await samsSeasons();
	const latestSeason = seasons ? seasons[0] : undefined;
	// check if its currently a month outside of the season
	const currentMonth = new Date().getMonth() + 1;
	const seasonMonth = !!(currentMonth >= 5 && currentMonth <= 9);
	// retrive players
	const teamPlayers = await samsPlayers(team.sbvvId);

	// webcal link
	const headersList = await headers();
	const host = process.env.NODE_ENV === "development" && headersList.get("host");
	const webcalLink = `webcal://${host || Club.domain}/ics/${params.slug}.ics`;

	return (
		<>
			{team.title && leagueName && <PageHeading title={team.title} subtitle={leagueName} />}

			<div className="col-full-content md:col-center-content *:mb-10 mt-6">
				{/* display players */}
				{teamPlayers?.players && teamPlayers.players?.length > 0 && (
					<div className="card *:mb-3" data-section="players">
						<h2 className="card-heading">Spieler</h2>
						<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
							{teamPlayers.players.map((player) => {
								return (
									<Fragment key={JSON.stringify(player)}>
										<div className="odd:bg-blac1k/5 inline-flex gap-1">
											<div className="flex justify-center items-center h-6 w-8 shrink-0">{player.number}</div>
											<div className="flex justify-center items-center h-6 w-8 shrink-0">
												<Flag
													code={player.nationality}
													className="h-full w-full object-cover border-onyx/10 border-[1px] shadow"
												/>
											</div>
											<div className="ml-1 col-span-2 text-balance">
												{player.fistName} {player.lastName}
											</div>
										</div>
									</Fragment>
								);
							})}
						</div>
						<p className="text-right text-sm italic text-gray-400 py-1 px-3" data-match-type="past">
							Saison {latestSeason?.name}
						</p>
					</div>
				)}

				{/* matches */}
				{futureMatches || pastMatches ? (
					<>
						<div className="card" data-section="calendar">
							<h2 className="card-heading">Mannschaftskalender</h2>
							<p className="my-3 text-pretty">
								<Link href={webcalLink} className="gap-1 hyperlink group">
									<IconSubscribe className="inline align-baseline" /> Abboniere unseren Kalender
								</Link>
								, um neue Termine saisonübergreifend automatisch in deiner Kalender-App zu empfangen.
							</p>
						</div>
						{pastMatches && (
							<div className="card-narrow-flex" data-section="match results">
								<h2 className="card-heading">Ergebnisse</h2>
								<Matches type="past" matches={pastMatches} highlightTeamId={team.sbvvId.toString()} />
							</div>
						)}
						{futureMatches ? (
							<div className="card-narrow-flex" data-section="future matches">
								<h2 className="card-heading">Spielplan</h2>
								<Matches type="future" matches={futureMatches} highlightTeamId={team.sbvvId.toString()} />
							</div>
						) : (
							<div className="card" data-section="empty future matches">
								<h2 className="card-heading">Spielplan</h2>
								<p>Aktuell konnten keine Spieltermine gefunden werden.</p>
								{!seasonMonth && (
									<p>
										Die Saison im Hallenvolleyball findet in der Regel in den Monaten von September bis April statt.
									</p>
								)}
							</div>
						)}
					</>
				) : (
					<div className="card-narrow-flex">
						<h2 className="card-heading">Keine Spieltermine gefunden</h2>
						{seasonMonth && (
							<p className="mb-6">
								Die Saison im Hallenvolleyball findet in der Regel in den Monaten von September bis April statt.
							</p>
						)}

						<p className="my-3 text-pretty">
							<Link href={webcalLink} className="gap-1 hyperlink group">
								<IconSubscribe className="inline align-baseline" /> Abboniere unseren Kalender
							</Link>
							, um neue Termine saisonübergreifend automatisch in deiner Kalender-App zu empfangen.
						</p>
					</div>
				)}
				{/* ranking */}
				{ranking && (
					<div className="*:card-narrow-flex" data-section="ranking">
						<RankingTable {...ranking} key={ranking.matchSeries.id} />
					</div>
				)}
				{/* training */}
				<div className="card *:mb-3" data-section="training">
					<h2 className="card-heading">Training</h2>
					{team.training && (
						<div className="leading-tight">
							<h3 className="font-bold flex gap-x-1 items-baseline">
								<IconClock className="text-xs" />
								Trainingszeiten:
							</h3>
							{team.training?.map((training) => {
								return (
									<Fragment key={JSON.stringify(training)}>
										<p>{training.zeit}</p>
										<Link href={training.map || ""} target="_blank" scroll={false} className="text-turquoise">
											{training.ort}
										</Link>
									</Fragment>
								);
							})}
						</div>
					)}
					{team.trainer && team.trainer?.length >= 1 && (
						<div className="trainers" data-section="trainers">
							<h3 className="font-bold flex gap-x-1 items-baseline">
								{team.trainer?.length === 1 ? <IconPerson className="text-xs" /> : <IconPersons className="text-xs" />}
								Trainer:
							</h3>
							<div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(180px,max-content))] md:grid-cols-[repeat(auto-fit,minmax(250px,max-content))]">
								{team.trainer?.map((trainer) => {
									// check if this trainer is in the member list and has an avatar
									const trainerList = getMembers();
									const filteredTrainers = trainerList.filter((thisTrainer) => thisTrainer.name === trainer.name);
									return (
										<div key={JSON.stringify(trainer)}>
											{filteredTrainers[0]?.avatar ? (
												<MembersCard {...trainer} avatar={filteredTrainers[0].avatar} />
											) : (
												<MembersCard {...trainer} />
											)}
										</div>
									);
								})}
							</div>
						</div>
					)}
					{team.trainer && team.trainer?.length < 1 && (
						<div className="trainers">
							<h3 className="font-bold flex gap-x-1 items-baseline">
								<IconEmail className="text-xs" />
								Kontakt:
							</h3>
							Bei Fragen und Interesse zu dieser Mannschaft, wende dich bitte an info@vcmuellheim.de
						</div>
					)}
				</div>

				{/* pictures */}
				{team.pictures && team.pictures.length >= 1 && (
					<div className="card *:mb-3" data-section="pictures">
						<h2 className="card-heading">Foto{team.pictures.length > 1 && "s"}</h2>

						<div className="grid gap-3 mt-3 grid-cols-[repeat(auto-fit,minmax(250px,1fr))]">
							{team.pictures.map((picture) => {
								return (
									<Link
										key={picture}
										href={picture}
										target="_blank"
										className="relative group hover:cursor-zoom-in rounded-md overflow-hidden after:opacity-0 hover:after:opacity-100 after:absolute after:inset-0 after:h-full after:w-full after:pointer-events-none hover:after:z-10 after:border-[0.4rem] after:border-dashed after:border-white after:duration-300"
									>
										<div className="realtive object-cover aspect-video sm:aspect-[3/2] xl:aspect-[4/3] m-0 p-0 group-hover:scale-105 transition-transform duration-700">
											<Image
												src={picture}
												width={540}
												height={310}
												alt={"Mannschaftsfoto"}
												className="object-cover h-full w-full m-0 p-0"
											/>
										</div>
									</Link>
								);
							})}
						</div>
					</div>
				)}

				<div className="text-center">
					<Link href="/#mannschaften" className="button">
						zu den anderen Mannschaften
					</Link>
				</div>
			</div>
		</>
	);
}
