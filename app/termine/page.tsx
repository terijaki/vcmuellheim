import PageHeading from "@/app/components/layout/PageHeading";
import Matches from "@/app/components/sams/Matches";
import Event from "@/app/components/ui/Event";
import getEvents from "@/app/utils/getEvents";
import { Club } from "@/project.config";
import dayjs from "dayjs";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { FaBullhorn as IconSubscribe } from "react-icons/fa6";
import { samsClubMatches, samsSeasons } from "../utils/sams/sams-server-actions";

export const metadata: Metadata = { title: "Termine" };

export const dynamic = "force-dynamic";

let EVENT_RANGE = 40; // days to look in the future for custom events

export default async function Termine() {
	// icsAllGeneration(); // TODO move to route //triggers the generation of the all.ics file

	// load custom events
	let events = await getEvents(0, EVENT_RANGE);
	let eventCount = events.length;
	const futureMatches = await samsClubMatches({ future: true });
	const matchCount = futureMatches?.filter((m) => m.matchSeries.type.toLowerCase() === "league").length || 0;
	const turnamentCount = futureMatches?.filter((m) => m.matchSeries.type.toLowerCase() === "competition").length || 0;

	if (matchCount + eventCount <= 3) {
		EVENT_RANGE = EVENT_RANGE * 2; // doubles the days if there is not much to show
		events = await getEvents(0, EVENT_RANGE);
		eventCount = events.length;
	}
	// dates
	const currentMonth = new Date().getMonth() + 1;
	const seasonMonth = !!(currentMonth >= 5 && currentMonth <= 9);
	const seasons = await samsSeasons();
	const pastTwoSeasons = seasons?.slice(0, 2) || [];


	// webcal link
	const headersList = await headers();
	const host = process.env.NODE_ENV === "development" && headersList.get("host");
	const webcalLink = `webcal://${host || Club.domain}/ics/all.ics`;

	return (
		<>
			<PageHeading title="Termine" />

			{/* CUSTOM EVENTS */}
			{eventCount > 0 && (
				<div className="col-full-content sm:col-center-content card mb-6 first-of-type:mt-6">
					<h2 className="card-heading">Veranstaltungen</h2>
					{events.map((event) => {
						return <Event {...event} totalSiblings={events.length} key={event.title + event.start} />;
					})}
				</div>
			)}

			{/* MATCHES */}
			{futureMatches && futureMatches.length > 0 && (
				<>
					<div className="col-full-content sm:col-center-content card mb-6 first-of-type:mt-6">
						<h2 className="card-heading">Vereinskalender</h2>
						<p className="my-3 text-pretty">
							<Link href={webcalLink} className="gap-1 hyperlink group">
								<IconSubscribe className="inline align-baseline" /> Abboniere unseren Vereinskalender
							</Link>
							, um neue Termine saisonübergreifend automatisch in deiner <span className="font-bold">Kalender-App</span>{" "}
							zu empfangen.
						</p>
					</div>
					<div className="col-full-content sm:col-center-content card-narrow-flex mb-6">
						{turnamentCount === 0 ? (
							<h2 className="card-heading">Ligaspiele</h2>
						) : (
							<h2 className="card-heading">Ligaspiele & Turneire</h2>
						)}
						<Matches matches={futureMatches} type="future" />
					</div>
				</>
			)}

			{/* ZERO MATCHES */}
			{matchCount === 0 && (
				<>
					<div className="col-full-content sm:col-center-content card mb-6 first-of-type:mt-6">
						<h2 className="card-heading">Keine Ligaspiele</h2>
						<p className="mb-3">Derzeit stehen keine weiteren Spieltermine an.</p>
						{seasonMonth && (
							<p className="mb-6">
								Die Saison im Hallenvolleyball findet in der Regel in den Monaten von September bis April statt.
							</p>
						)}
						<p className="text-pretty">
							<Link href={webcalLink} className="gap-1 hyperlink group">
								<IconSubscribe className="inline align-baseline" /> Abboniere unseren Kalender
							</Link>
							, um neue Termine saisonübergreifend automatisch in deiner <span className="font-bold">Kalender-App</span>{" "}
							zu empfangen.
						</p>
					</div>
					{currentMonth >= 4 && currentMonth <= 9 ? (
						<div className="col-full-content sm:col-center-content card mb-6">
							<h2 className="card-heading">Außerhalb der Saison?</h2>
							<p className="mt-3">
								Die Saison im Hallenvolleyball findet in der Regel in den Monaten von September bis April statt.
								Dazwischen wird die nächste Saison vorbereitet und die neusten Informationen vom Südbadischen
								Volleyballverband wurden ggf. noch nicht veröffentlicht.
							</p>
							{pastTwoSeasons.length === 2 && (
								<>
									<p className="mt-3">Offizielle Zeitspanne der letzten zwei Saisons:</p>
									{pastTwoSeasons.map((season) => (
										<ul key={season.id}>
											<li className="list-disc ml-6">
												{`${dayjs(season.begin).format("YYYY-MM-DD")} bis ${dayjs(season.end).format("YYYY-MM-DD")}`}
											</li>
										</ul>
									))}
								</>
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
