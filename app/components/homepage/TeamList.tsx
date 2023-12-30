import React from "react";
import TeamCard from "@/app/components/ui/TeamCard";
import { getTeams } from "@/app/utils/getTeams";

export default function ListTeams() {
	const teams = getTeams();
	return (
		<div className="columns-[360px_3] gap-4">
			{teams.map((team, index) => {
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
	);
}
