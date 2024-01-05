import SectionHeading from "@/app/components/layout/SectionHeading";
import { getTeams } from "@/app/utils/getTeams";
import TeamCard from "@/app/components/ui/TeamCard";

export default function HomeTeams() {
	// get number of teams
	const numberOfTeams = getTeams().length;
	// turn number to requivalent word, eg. 2 = zwei
	const numToWordsDe = require("num-words-de");
	const teamNumber = numToWordsDe.numToWord(numberOfTeams, { uppercase: false, indefinite_eine: true });
	if (numberOfTeams > 0) {
		return (
			<section className="col-center-content mb-6">
				<a
					id="mannschaften"
					className="scroll-anchor"
				></a>
				<SectionHeading text="Mannschaften" />
				<p className="text-center opacity-60 -mt-2 mb-3">
					Zurzeit umfasst unser Verein {teamNumber} {numberOfTeams > 1 ? "Mannschaften" : "Mannschaft"}:
				</p>
				{/* <TeamsList /> */}
				<div className="columns-[360px_3] gap-4">
					{getTeams().map((team, index) => {
						if (team.title) {
							return (
								<div key={index}>
									<TeamCard
										{...team}
										index={index}
									/>
								</div>
							);
						}
					})}
				</div>
			</section>
		);
	}
}
