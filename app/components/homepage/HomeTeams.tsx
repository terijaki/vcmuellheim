import SectionHeading from "@/app/components/layout/SectionHeading";
import TeamCard from "@/app/components/ui/TeamCard";
import { getTeams } from "@/app/utils/getTeams";

export default async function HomeTeams() {
	// get number of teams
	const teams = await getTeams();
	const numberOfTeams = teams.length;
	// turn number to requivalent word, eg. 2 = zwei
	const numToWordsDe = require("num-words-de");
	const teamNumber = numToWordsDe.numToWord(numberOfTeams, {
		uppercase: false,
		indefinite_eine: true,
	});
	if (numberOfTeams > 0) {
		return (
			<section className="col-center-content mb-6">
				<div id="mannschaften" className="scroll-anchor" />
				<SectionHeading text="Mannschaften" />
				<p className="text-center opacity-60 -mt-2 mb-3">
					Zurzeit umfasst unser Verein {teamNumber} {numberOfTeams > 1 ? "Mannschaften" : "Mannschaft"}:
				</p>
				{/* <TeamsList /> */}
				<div className="columns-[360px_3] gap-4">
					{teams.map((team, index) => {
						if (team.title) {
							return (
								<div key={team.title}>
									<TeamCard {...team} index={index} />
								</div>
							);
						}
					})}
				</div>
			</section>
		);
	}
}
