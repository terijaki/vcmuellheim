import { createContext, useContext } from "react";

export const TeamContext = createContext<{ gender: string; leagueParticipation: boolean }>({
	gender: "",
	leagueParticipation: false,
});

export const useTeamContext = () => useContext(TeamContext);
