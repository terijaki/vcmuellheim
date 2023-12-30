import SectionHeading from "@/app/components/layout/SectionHeading";
import TeamsList from "@/app/components/homepage/TeamList";
import { getTeams } from "@/app/utils/getTeams";

export default function HomeTeams() {
	// get number of teams
	const numberOfTeams = getTeams().length;
	// turn number to requivalent word, eg. 2 = zwei
	const numToWordsDe = require("num-words-de");
	const teamNumber = numToWordsDe.numToWord(numberOfTeams, { uppercase: false, indefinite_eine: true });
	if (numberOfTeams > 0) {
		return (
			<section
				id="mannschaften"
				className="col-center-content mb-6"
			>
				<SectionHeading text="Mannschaften" />
				<p className="text-center opacity-60 -mt-2 mb-3">
					Zurzeit umfasst unser Verein {teamNumber} {numberOfTeams > 1 ? "Mannschaften" : "Mannschaft"}:
				</p>
				<TeamsList />
			</section>
		);
	}
}
