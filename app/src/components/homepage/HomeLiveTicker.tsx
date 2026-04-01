import { Badge, Box, Card, Container, Flex, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { LiveTickerDisplayMatch } from "../../utils/liveTicker";
import ClubLogo from "../ClubLogo";

type HomeLiveTickerProps = {
	matches: LiveTickerDisplayMatch[];
};

export default function HomeLiveTicker({ matches }: HomeLiveTickerProps) {
	return (
		<Container size="lg" w="100%">
			<SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
				{matches.map((m) => (
					<LiveMatchCard key={m.matchUuid} match={m} />
				))}
			</SimpleGrid>
		</Container>
	);
}

function LiveMatchCard({ match }: { match: LiveTickerDisplayMatch }) {
	const activeSet = match.activeSetNumber ? match.setScores.find((setScore) => setScore.setNumber === match.activeSetNumber) : undefined;

	const team1Logo = match.team1ClubUuid ? (
		<ClubLogo clubUuid={match.team1ClubUuid} label={match.team1Name} size={104} />
	) : match.team1ClubSlug ? (
		<ClubLogo clubSlug={match.team1ClubSlug} label={match.team1Name} size={104} />
	) : (
		<ClubLogo logoUrl={null} label={match.team1Name} size={104} />
	);

	const team2Logo = match.team2ClubUuid ? (
		<ClubLogo clubUuid={match.team2ClubUuid} label={match.team2Name} size={104} />
	) : match.team2ClubSlug ? (
		<ClubLogo clubSlug={match.team2ClubSlug} label={match.team2Name} size={104} />
	) : (
		<ClubLogo logoUrl={null} label={match.team2Name} size={104} />
	);

	const team1LogoMobile = match.team1ClubUuid ? (
		<ClubLogo clubUuid={match.team1ClubUuid} label={match.team1Name} size={72} />
	) : match.team1ClubSlug ? (
		<ClubLogo clubSlug={match.team1ClubSlug} label={match.team1Name} size={72} />
	) : (
		<ClubLogo logoUrl={null} label={match.team1Name} size={72} />
	);

	const team2LogoMobile = match.team2ClubUuid ? (
		<ClubLogo clubUuid={match.team2ClubUuid} label={match.team2Name} size={72} />
	) : match.team2ClubSlug ? (
		<ClubLogo clubSlug={match.team2ClubSlug} label={match.team2Name} size={72} />
	) : (
		<ClubLogo logoUrl={null} label={match.team2Name} size={72} />
	);

	return (
		<Card bg="rgba(255, 255, 255, 0.9)" c="onyx">
			<Stack gap="md">
				<Group justify="flex-end">
					{match.isFinished ? (
						<Badge color="gray" variant="light">
							Beendet
						</Badge>
					) : (
						<Badge color="red" variant="filled">
							● LIVE
						</Badge>
					)}
				</Group>
				<Stack gap="xs" hiddenFrom="sm">
					<Flex justify="space-between" align="flex-start" gap="xs">
						<Flex justify="center" style={{ flex: 1, minWidth: 0 }}>
							{team1LogoMobile}
						</Flex>

						<Stack gap={0} align="center" style={{ minWidth: 96 }}>
							<Text fw={900} size="3.2rem" c="onyx" lh={1} style={{ whiteSpace: "nowrap" }}>
								{match.setPointsText}
							</Text>

							{activeSet ? (
								<Text size="md" fw={800}>
									{activeSet.team1Score}:{activeSet.team2Score}
								</Text>
							) : (
								<Text c="dimmed" size="xs">
									Sätze
								</Text>
							)}
						</Stack>

						<Flex justify="center" style={{ flex: 1, minWidth: 0 }}>
							{team2LogoMobile}
						</Flex>
					</Flex>

					<Flex justify="space-between" align="center" gap="xl">
						<Text ta="center" fw={500} lineClamp={2} style={{ flex: 1, minWidth: 0, textWrap: "balance" }}>
							{match.team1Name}
						</Text>
						<Box visibleFrom="xs" w={96} />
						<Text ta="center" fw={500} lineClamp={2} style={{ flex: 1, minWidth: 0, textWrap: "balance" }}>
							{match.team2Name}
						</Text>
					</Flex>
				</Stack>

				<Flex justify="space-between" align="flex-start" gap="xs" visibleFrom="sm">
					<Stack gap={6} align="center" style={{ flex: 1 }}>
						{team1Logo}
						<Text ta="center" fw={500} lineClamp={2} style={{ textWrap: "balance" }}>
							{match.team1Name}
						</Text>
					</Stack>

					<Stack gap={0} align="center" style={{ minWidth: 140 }}>
						<Text fw={900} size="4rem" c="onyx" lh={1} style={{ whiteSpace: "nowrap" }}>
							{match.setPointsText}
						</Text>

						{activeSet ? (
							<Text size="lg" fw={800}>
								{activeSet.team1Score}:{activeSet.team2Score}
							</Text>
						) : (
							<Text c="dimmed" size="xs">
								Sätze
							</Text>
						)}
					</Stack>

					<Stack gap={6} align="center" style={{ flex: 1 }}>
						{team2Logo}
						<Text ta="center" fw={500} lineClamp={2} style={{ textWrap: "balance" }}>
							{match.team2Name}
						</Text>
					</Stack>
				</Flex>

				{match.setScores.length > 0 && (
					<Stack gap={0} align="center">
						{match.setScores.map((setScore) => {
							const team1IsWinning = setScore.team1Score > setScore.team2Score;
							const team2IsWinning = setScore.team2Score > setScore.team1Score;
							return (
								<SimpleGrid key={`${match.matchUuid}-${setScore.setNumber}`} cols={3} ta="center" spacing="lg">
									<Text fw={team1IsWinning ? 900 : 400} ta="right">
										{setScore.team1Score}
									</Text>
									<Text c="lion" ta="center">
										({setScore.setNumber})
									</Text>
									<Text fw={team2IsWinning ? 900 : 400} ta="left">
										{setScore.team2Score}
									</Text>
								</SimpleGrid>
							);
						})}
					</Stack>
				)}
			</Stack>
		</Card>
	);
}
