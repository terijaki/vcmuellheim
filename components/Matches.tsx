import { Club } from "@/project.config";
import { Box, Flex, Grid, GridCol, Group, Stack, Text } from "@mantine/core";
import { FaSquarePollVertical as IconResult } from "react-icons/fa6";
import type { Match } from "sams-rpc";
import MapsLink from "./MapsLink";

export default function Matches({
	matches,
	type,
	highlightTeamId,
}: { matches: Match[]; type: "future" | "past"; highlightTeamId?: string }) {
	// define how dates should be displayed
	const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" });
	// structure the last update date
	let dateDisplay = "";
	if (matches[0].matchSeries?.updated) {
		const dateInput = new Date(matches[0].matchSeries?.updated);
		dateDisplay = `${dateFormat.format(dateInput).toString()} Uhr`;
	}
	const isOddMatches = Boolean(matches.length % 2 === 0);

	if (type === "past") {
		return (
			<Box>
				<Text c="dimmed" size="xs" ta="right" pr="sm" pb="xs">
					Stand: <time dateTime={matches[0].matchSeries.updated || undefined}>{dateDisplay}</time>
				</Text>
				<Stack gap={0}>
					{matches.map((match, index) => {
						// determine if this is a win for the club/team
						let winForClubOrTeam = false;
						const winner = match.results && match.team[Number(match.results.winner) - 1];
						if (highlightTeamId) {
							const winnerId = winner?.id;
							winForClubOrTeam = Boolean(winnerId && winnerId === highlightTeamId);
						} else {
							winForClubOrTeam = Boolean(winner && winner.club === Club.shortName);
						}
						// determine if the index is odd or even for alternating background colors
						const oddIndex = Boolean((isOddMatches ? index : index + 1) % 2 === 0);
						return (
							<Grid
								key={match.uuid}
								data-match-number={match.number}
								data-match-id={match.id}
								data-match-uuid={match.uuid}
								bg={oddIndex ? "gray.1" : undefined}
								p="xs"
								gutter={{ base: 0, sm: "xs" }}
								align="center"
							>
								{/* date and location */}
								<GridCol span={{ base: 12, sm: 3 }}>
									<Flex direction={{ base: "row", sm: "column" }} columnGap="xs" rowGap={0} align="center">
										{match.date && (
											<time dateTime={match.date}>
												<Text size="sm" hiddenFrom="sm">
													{match.date}
												</Text>
												<Text size="md" visibleFrom="sm">
													{match.date}
												</Text>
											</time>
										)}
										{match.location && (
											<MapsLink
												location={{
													name: match.location.name,
													address: {
														street: match.location.street,
														postalCode: match.location.postalCode,
														city: match.location.city,
													},
												}}
												size="sm"
												maw={{ base: "100%", sm: 160 }}
											/>
										)}
									</Flex>
								</GridCol>
								{/* teams & league*/}
								<GridCol span={{ base: 12, sm: 7 }}>
									<Stack gap={0}>
										<Text lineClamp={2}>
											{match.team?.map((team, index) => {
												return (
													<Text key={team.id} span fw="bold" data-team-id={team.id} data-team-name={team.name}>
														{index > 0 && " : "}
														{team.name}
													</Text>
												);
											})}
										</Text>
										{match.matchSeries?.name && (
											<Text c="lion" size="sm">
												{match.matchSeries?.name}
											</Text>
										)}
									</Stack>
								</GridCol>
								{/* score*/}
								{match.results && (
									<GridCol span={{ base: 12, sm: 2 }}>
										<Group gap={4} c={winForClubOrTeam ? "turquoise" : undefined}>
											<IconResult />
											<Text span size="sm" fw="bold" hiddenFrom="sm">
												{match.results.setPoints}
											</Text>
											<Text span size="lg" fw="bold" visibleFrom="sm">
												{match.results.setPoints}
											</Text>
											{/* {match.results.ballPoints && (
												<Text span c="dimmed" size="xs">
													({match.results.ballPoints})
												</Text>
											)} */}
										</Group>
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
				<Text c="dimmed" size="xs" ta="right" pr="sm" pb="xs">
					Stand: <time dateTime={matches[0].matchSeries.updated || undefined}>{dateDisplay}</time>
				</Text>
				{matches.map((match, index) => {
					// determine if the index is odd or even for alternating background colors
					const oddIndex = Boolean((isOddMatches ? index : index + 1) % 2 === 0);
					return (
						<Grid
							key={match.uuid}
							data-match-number={match.number}
							data-match-id={match.id}
							data-match-uuid={match.uuid}
							bg={oddIndex ? "gray.1" : undefined}
							p="xs"
							gutter={{ base: 0, sm: "xs" }}
							align="center"
						>
							<GridCol span={{ base: 12, sm: 3 }}>
								<Flex columnGap="xs" rowGap={0} align="center" direction={{ base: "row", sm: "column" }} c="onyx">
									{match.date && (
										<time dateTime={match.date}>
											<Text size="sm" fw="bold">
												{match.date}
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
										{match.matchSeries.type?.toLowerCase() === "league" &&
											match.team?.map((team, index) => {
												if (team.id && (highlightTeamId || highlightTeamId !== team.id.toString())) {
													return (
														<Text key={team.name} span fw="bold" data-team-id={team.id} data-team-name={team.name}>
															{index > 0 && highlightTeamId && " : "}
															{team.name}
														</Text>
													);
												}
											})}
									</Text>
									<Text c="lion" size="xs">
										{match.matchSeries?.name || match.matchSeries?.hierarchy?.name}
									</Text>
								</Stack>
							</GridCol>

							{match.location && (
								<GridCol span={{ base: 12, sm: 3 }}>
									<Text truncate>
										<MapsLink
											location={{
												name: match.location.name,
												address: {
													street: match.location.street,
													postalCode: match.location.postalCode,
													city: match.location.city,
												},
											}}
											size="sm"
											maw={{ base: "100%", sm: 160 }}
										/>
									</Text>
								</GridCol>
							)}
						</Grid>
					);
				})}
			</Box>
		);
	}
}
