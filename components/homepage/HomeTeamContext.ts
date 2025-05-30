import { createContext, useContext } from "react";

export const TeamContext = createContext<{ gender: string | null; leagueParticipation: boolean }>({
	gender: null,
	leagueParticipation: false,
});

export const useTeamContext = () => useContext(TeamContext);
