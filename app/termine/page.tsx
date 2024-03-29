import PageHeading from "@/app/components/layout/PageHeading";
import { cachedGetTeamIds } from "@/app/utils/sams/cachedGetClubData";
import { icsAllGeneration } from "@/app/utils/icsGeneration";
import { cachedGetMatches } from "@/app/utils/sams/cachedGetMatches";
import Matches from "@/app/components/sams/Matches";
import { FaBullhorn as IconSubscribe } from "react-icons/fa6";
import Link from "next/link";
import { env } from "process";

// generate a custom title
import { Metadata, ResolvingMetadata } from "next";
export async function generateMetadata({}, parent: ResolvingMetadata): Promise<Metadata> {
	return {
		title: "Termine",
	};
}

export default function Termine() {
	icsAllGeneration(); // triggers the generation of the all.ics file

	if (cachedGetMatches(cachedGetTeamIds("id"), "future").length > 0) {
		return (
			<>
				<PageHeading title="Spielermine unserer Mannschaften" />
				<div className="col-full-content sm:col-center-content card my-6">
					<h2 className="card-heading">Vereinskalender</h2>
					<p className="my-3 text-pretty">
						<Link
							href={"webcal://" + env.BASE_URL + "/ics/all.ics"}
							className="gap-1 hyperlink group"
						>
							<IconSubscribe className="inline align-baseline" /> Abboniere unseren Vereinskalender
						</Link>
						, um neue Termine saisonübergreifend automatisch in deiner <span className="font-bold">Kalender-App</span> zu empfangen.
					</p>
				</div>
				<div className="col-full-content sm:col-center-content card-narrow-flex mb-6">
					<h2 className="card-heading">Termine</h2>
					<Matches
						teamId={cachedGetTeamIds("id")}
						filter="future"
					/>
				</div>
			</>
		);
	} else {
		const currentMonth = new Date().getMonth() + 1;
		const seasonMonth = currentMonth >= 5 && currentMonth <= 9 ? true : false;
		return (
			<>
				<PageHeading title="Spielermine unserer Mannschaften" />
				<div className="col-full-content sm:col-center-content card my-6">
					<p className="mb-3">Derzeit stehen keine weiteren Spieltermine an.</p>
					{seasonMonth && <p className="mb-6">Die Saison im Hallenvolleyball findet in der Regel in den Monaten von September bis April statt.</p>}
					<p className="text-pretty">
						<Link
							href={"webcal://" + env.BASE_URL + "/ics/all.ics"}
							className="gap-1 hyperlink group"
						>
							<IconSubscribe className="inline align-baseline" /> Abboniere unseren Kalender
						</Link>
						, um neue Termine saisonübergreifend automatisch in deiner <span className="font-bold">Kalender-App</span> zu empfangen.
					</p>
				</div>
			</>
		);
	}
}
