import { Box, Flex, Grid, GridCol, Group, Stack, Text } from "@mantine/core";
import dayjs from "dayjs";
import { SAMS } from "@/project.config";
import "dayjs/locale/de";
import { FaSquarePollVertical as IconResult } from "react-icons/fa6";
import type { LeagueMatchesResponse } from "@/lambda/sams/types";
import { useSamsTeams } from "../lib/hooks";
import MapsLink from "./MapsLink";

dayjs.locale("de");

export default function Matches({
	matches = [],
	timestamp,
	type,
	highlightTeamUuid,
	uniqueLeague = false,
}: {
	matches: LeagueMatchesResponse["matches"];
	timestamp?: Date;
	type: "future" | "past";
	highlightTeamUuid?: string;
	uniqueLeague?: boolean;
}) {
	const { data: samsTeams } = useSamsTeams();
	if (!matches || matches.length === 0) return null;
	// define how dates should be displayed
	const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" });
	// structure the last update date
	let dateDisplay = "";
	if (timestamp) {
		const dateInput = new Date(timestamp);
		dateDisplay = `${dateFormat.format(dateInput).toString()} Uhr`;
	}
	const isOddMatches = Boolean(matches.length % 2 === 0);

	// league data so that we can get the league name from the league id
	const ourTeams = samsTeams?.teams;
	const leagues = new Map<string, string>();
	for (const team of ourTeams || []) {
		if (team.leagueUuid && team.leagueName) leagues.set(team.leagueUuid, team.leagueName);
	}

	if (type === "past") {
		return (
			<Box>
				{timestamp && (
					<Text c="dimmed" size="xs" ta="right" pr="sm" pb="xs">
						Stand: <time dateTime={timestamp?.toISOString()}>{dateDisplay}</time>
					</Text>
				)}
				<Stack gap={0}>
					{matches.map((match, index) => {
						const winnerId = match.results?.winner;
						const winnerName = match.results?.winnerName;
						// determine if this is a win for the club/team
						let winForClubOrTeam = Boolean(winnerId && winnerId === highlightTeamUuid);
						if (!highlightTeamUuid) winForClubOrTeam = Boolean(winnerName?.includes(SAMS.name));
						// determine if the index is odd or even for alternating background colors
						const oddIndex = Boolean((isOddMatches ? index : index + 1) % 2 === 0);
						const team1 = match._embedded?.team1;
						const team2 = match._embedded?.team2;
						const leagueName = match.leagueUuid && leagues.get(match.leagueUuid);
						return (
							<Grid key={match.uuid} data-match-number={match.matchNumber} data-match-uuid={match.uuid} bg={oddIndex ? "gray.1" : undefined} p="xs" gutter={{ base: 0, sm: "xs" }} align="center">
								{/* date and location */}
								<GridCol span={{ base: 12, sm: 3 }}>
									<Flex direction={{ base: "row", sm: "column" }} columnGap="xs" rowGap={0} align="center">
										{match.date && (
											<time dateTime={match.date}>
												<Text size="sm" hiddenFrom="sm">
													{dayjs(match.date).format("D MMMM YYYY")}
												</Text>
												<Text size="md" visibleFrom="sm">
													{dayjs(match.date).format("D MMMM YYYY")}
												</Text>
											</time>
										)}
										{match.location && <MapsLink {...match.location} size="sm" maw={{ base: "100%", sm: 160 }} />}
									</Flex>
								</GridCol>
								{/* teams & league*/}
								<GridCol span={{ base: 12, sm: 7 }}>
									<Stack gap={0}>
										<Text lineClamp={2}>
											<Text span fw={!team1?.name.includes(SAMS.name) ? undefined : undefined} data-team1-uuid={team1?.uuid} data-team1-name={team1?.name}>
												{team1?.name}
											</Text>
											{team1 && team2 && " : "}
											<Text span fw={!team2?.name.includes(SAMS.name) ? undefined : undefined} data-team2-uuid={team2?.uuid} data-team2-name={team2?.name}>
												{team2?.name}
											</Text>
										</Text>
										{!uniqueLeague && leagueName && (
											<Text c="lion" size="sm">
												{leagueName}
											</Text>
										)}
									</Stack>
								</GridCol>
								{/* score*/}
								{match.results && (
									<GridCol span={{ base: 12, sm: 2 }}>
										<Flex columnGap="xs" rowGap={0} direction={{ base: "row", sm: "column" }} align={{ base: "center", sm: "flex-start" }}>
											<Group gap={4} c={winForClubOrTeam ? "turquoise" : undefined}>
												<IconResult />
												<Text span size="sm" fw="bold" hiddenFrom="sm">
													{match.results.setPoints}
												</Text>
												<Text span size="lg" fw="bold" visibleFrom="sm">
													{match.results.setPoints}
												</Text>
												{winForClubOrTeam && <Text span>🏆</Text>}
											</Group>
											{match.results.sets && match.results.sets.length > 0 && (
												<Text span c="dimmed" size="xs">
													({match.results.sets?.map((set) => set.ballPoints).join(", ")})
												</Text>
											)}
										</Flex>
									</GridCol>
								)}
							</Grid>
						);
					})}
				</Stack>
			</Box>
		);
	}
	if (type === "future") {
		return (
			<Box>
				{timestamp && (
					<Text c="dimmed" size="xs" ta="right" pr="sm" pb="xs">
						Stand: <time dateTime={timestamp?.toISOString()}>{dateDisplay}</time>
					</Text>
				)}
				{matches.map((match, index) => {
					// determine if the index is odd or even for alternating background colors
					const oddIndex = Boolean((isOddMatches ? index : index + 1) % 2 === 0);
					const team1 = match._embedded?.team1;
					const team2 = match._embedded?.team2;
					const leagueName = match.leagueUuid && leagues.get(match.leagueUuid);
					return (
						<Grid key={match.uuid} data-match-number={match.matchNumber} data-match-uuid={match.uuid} bg={oddIndex ? "gray.1" : undefined} p="xs" gutter={{ base: 0, sm: "xs" }} align="center">
							<GridCol span={{ base: 12, sm: 3 }}>
								<Flex columnGap="xs" rowGap={0} align="center" direction={{ base: "row", sm: "column" }} c="onyx">
									{match.date && (
										<time dateTime={match.date}>
											<Text size="sm" fw="bold">
												{dayjs(match.date).format("D MMMM YYYY")}
											</Text>
										</time>
									)}
									{match.time && Number(match.time.slice(0, 2)) > 0 && (
										<Text size="sm" fw="bold">
											{match.time} Uhr
										</Text>
									)}
								</Flex>
							</GridCol>
							<GridCol span={{ base: 12, sm: 6 }}>
								<Stack gap={0}>
									{/* League or Competition */}
									<Text lineClamp={2}>
										<Text span fw={team1?.name.includes(SAMS.name) ? undefined : undefined} data-team1-uuid={team1?.uuid} data-team1-name={team1?.name}>
											{team1?.name}
										</Text>
										{team1 && team2 && " : "}
										<Text span fw={team2?.name.includes(SAMS.name) ? undefined : undefined} data-team2-uuid={team2?.uuid} data-team2-name={team2?.name}>
											{team2?.name}
										</Text>
									</Text>
									{!uniqueLeague && leagueName && (
										<Text c="lion" size="sm">
											{leagueName}
										</Text>
									)}
								</Stack>
							</GridCol>

							{match.location && (
								<GridCol span={{ base: 12, sm: 3 }}>
									<MapsLink {...match.location} size="sm" maw={{ base: "100%", sm: 160 }} />
								</GridCol>
							)}
						</Grid>
					);
				})}
			</Box>
		);
	}
}
