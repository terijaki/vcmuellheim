import PageHeading from "@/app/components/layout/PageHeading";
import { getTeamIds } from "../utils/samsClubData";
import { icsAllGeneration } from "../utils/icsGeneration";
import { getMatches } from "@/app/utils/samsMatches";
import Matches from "@/app/components/sams/Matches";
import { FaArrowsRotate as IconSubscribe } from "react-icons/fa6";
import Link from "next/link";

// generate a custom title
import { Metadata, ResolvingMetadata } from "next";
export async function generateMetadata({}, parent: ResolvingMetadata): Promise<Metadata> {
	return {
		title: "Termine",
	};
}

export default function Termine() {
	icsAllGeneration(); // triggers the generation of the all.ics file

	if ((getMatches(getTeamIds("id"), "future").length = 0)) {
		return (
			<>
				<PageHeading title="Spielermine unserer Mannschaften" />
				<div className="col-center-content card my-6">
					<p className="mb-3">Derzeit stehen keine weiteren Spieltermine an.</p>
					<p className="text-pretty">
						<Link
							href={"webcal://vcmuellheim.de/ics/all.ics"}
							className="gap-1 hyperlink group"
						>
							<IconSubscribe className="inline align-baseline group-hover:animate-spin" /> Abboniere unseren Kalender
						</Link>
						, um neue Termine saisonübergreifend automatisch in deiner Kalender-App zu empfangen.
					</p>
				</div>
			</>
		);
	}

	return (
		<>
			<PageHeading title="Spielermine unserer Mannschaften" />
			<div className="col-center-content card-narrow my-6">
				<p className="p-4 pb-0 text-pretty">
					<Link
						href={""}
						className="gap-1 hyperlink group"
					>
						<IconSubscribe className="inline align-baseline group-hover:animate-spin" /> Abboniere unseren Kalender
					</Link>
					, um neue Termine saisonübergreifend automatisch in deiner Kalender-App zu empfangen.
				</p>
				<Matches
					teamId={getTeamIds("id")}
					filter="future"
				/>
			</div>
		</>
	);
}
