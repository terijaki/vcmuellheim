import Link from "next/link";
import { Club } from "@/project.config";
import { Metadata, ResolvingMetadata } from "next";
import PageHeading from "@/app/components/layout/PageHeading";
import { icsAllGeneration } from "@/app/utils/icsGeneration";
import { cachedGetMatches } from "@/app/utils/sams/cachedGetMatches";
import getEvents, { eventObject } from "@/app/utils/getEvents";
import Events from "@/app/components/ui/Events";
import Matches from "@/app/components/sams/Matches";
import { FaBullhorn as IconSubscribe } from "react-icons/fa6";
import { getClubsTeamIds } from "../utils/sams/clubs";
import { getSeasons } from "../utils/sams/seasons";

export const revalidate = 120;

// generate a custom title
export async function generateMetadata({}, parent: ResolvingMetadata): Promise<Metadata> {
	return {
		title: "Termine",
	};
}

let EVENT_RANGE = 40; // days to look in the future for custom events

export default async function Termine() {
	icsAllGeneration(); // triggers the generation of the all.ics file

	// get team Ids
	const clubLeagueTeamIds = (await getClubsTeamIds("id", true)) || [];
	const clubAllTeamIds = (await getClubsTeamIds("id", false)) || [];

	// load custom events
	let events: eventObject[] = getEvents(0, EVENT_RANGE);
	let eventCount = events.length;
	let matchCount = cachedGetMatches(clubAllTeamIds, "future").length;
	let turnamentCount = matchCount - cachedGetMatches(clubLeagueTeamIds, "future").length;
	if (matchCount + eventCount <= 3) {
		EVENT_RANGE = EVENT_RANGE * 2; // doubles the days if there is not much to show
		events = getEvents(0, EVENT_RANGE);
		eventCount = events.length;
	}
	// dates
	const currentMonth = new Date().getMonth() + 1;
	const seasonMonth = currentMonth >= 5 && currentMonth <= 9 ? true : false;
	const pastTwoSeasons = (await getSeasons(2)) || [];

	return (
		<>
			<PageHeading title="Termine" />

			{/* CUSTOM EVENTS */}
			{eventCount > 0 && (
				<>
					<div className="col-full-content sm:col-center-content card mb-6 first-of-type:mt-6">
						<h2 className="card-heading">Veranstaltungen</h2>
						{events.map((event) => {
							return (
								<Events
									{...event}
									totalSiblings={events.length}
									key={event.title + event.start}
								/>
							);
						})}
					</div>
				</>
			)}

			{/* MATCHES */}
			{matchCount > 0 && (
				<>
					<div className="col-full-content sm:col-center-content card mb-6 first-of-type:mt-6">
						<h2 className="card-heading">Vereinskalender</h2>
						<p className="my-3 text-pretty">
							<Link
								href={"webcal://" + Club.domain + "/ics/all.ics"}
								className="gap-1 hyperlink group"
							>
								<IconSubscribe className="inline align-baseline" /> Abboniere unseren Vereinskalender
							</Link>
							, um neue Termine saisonübergreifend automatisch in deiner <span className="font-bold">Kalender-App</span> zu empfangen.
						</p>
					</div>
					<div className="col-full-content sm:col-center-content card-narrow-flex mb-6">
						{turnamentCount == 0 ? <h2 className="card-heading">Ligaspiele</h2> : <h2 className="card-heading">Ligaspiele & Turneire</h2>}
						<Matches
							teamId={clubAllTeamIds}
							filter="future"
						/>
					</div>
				</>
			)}

			{/* ZERO MATCHES */}
			{matchCount == 0 && (
				<>
					<div className="col-full-content sm:col-center-content card mb-6 first-of-type:mt-6">
						<h2 className="card-heading">Keine Ligaspiele</h2>
						<p className="mb-3">Derzeit stehen keine weiteren Spieltermine an.</p>
						{seasonMonth && <p className="mb-6">Die Saison im Hallenvolleyball findet in der Regel in den Monaten von September bis April statt.</p>}
						<p className="text-pretty">
							<Link
								href={"webcal://" + Club.domain + "/ics/all.ics"}
								className="gap-1 hyperlink group"
							>
								<IconSubscribe className="inline align-baseline" /> Abboniere unseren Kalender
							</Link>
							, um neue Termine saisonübergreifend automatisch in deiner <span className="font-bold">Kalender-App</span> zu empfangen.
						</p>
					</div>
					{currentMonth >= 4 && currentMonth <= 9 ? (
						<div className="col-full-content sm:col-center-content card mb-6">
							<h2 className="card-heading">Außerhalb der Saison?</h2>
							<p className="mt-3">
								Die Saison im Hallenvolleyball findet in der Regel in den Monaten von September bis April statt. Dazwischen wird die nächste Saison vorbereitet und die neusten Informationen vom
								Südbadischen Volleyballverband wurden ggf. noch nicht veröffentlicht.
							</p>
							{pastTwoSeasons.length == 2 && (
								<p className="mt-3">
									Offizielle Zeitspanne der letzten zwei Saisons:
									{pastTwoSeasons.map((season) => (
										<ul key={season.id}>
											<li className="list-disc ml-6">
												{season.begin.toLocaleString("de", {
													month: "long",
													year: "numeric",
												})}{" "}
												<span className="mx-1">bis</span>
												{season.end.toLocaleString("de", {
													month: "long",
													year: "numeric",
												})}
											</li>
										</ul>
									))}
								</p>
							)}
						</div>
					) : (
						""
					)}
				</>
			)}
		</>
	);
}
