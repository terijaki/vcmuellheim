import { Badge, Box, Card, Container, Group, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { SamsLiveMatch, SamsTickerWsMatchUpdate } from "@/lambda/sams/types";
import { SamsTickerWsMatchUpdateSchema } from "@/lambda/sams/types";
import { getSamsLiveTickerFn } from "../../server/functions/sams";

const SAMS_WS_URL = "wss://backend.sams-ticker.de/indoor/baden";

/** React Query hook — fetches the HTTP ticker snapshot every 5 minutes. */
function useSamsTickerSnapshot() {
	return useQuery({
		queryKey: ["samsLiveTicker"],
		queryFn: () => getSamsLiveTickerFn(),
		refetchInterval: 5 * 60 * 1000,
		staleTime: 30 * 1000,
	});
}

/**
 * Merges a WebSocket MATCH_UPDATE message into the current list of matches,
 * updating only the match whose matchId equals the payload's matchUuid.
 */
function applyWsUpdate(matches: SamsLiveMatch[], update: SamsTickerWsMatchUpdate): SamsLiveMatch[] {
	return matches.map((m) =>
		m.matchId === update.payload.matchUuid ? { ...m, started: update.payload.started, finished: update.payload.finished, setPoints: update.payload.setPoints, matchSets: update.payload.matchSets } : m,
	);
}

export default function HomeLiveTicker() {
	const { data: snapshot } = useSamsTickerSnapshot();
	const [liveMatches, setLiveMatches] = useState<SamsLiveMatch[]>([]);
	const wsRef = useRef<WebSocket | null>(null);

	// Sync snapshot → local state when React Query updates
	useEffect(() => {
		if (snapshot?.matches) {
			setLiveMatches(snapshot.matches);
		}
	}, [snapshot]);

	// Determine if any of our matches are currently active
	const hasActiveMatches = liveMatches.some((m) => m.started && !m.finished);

	// Manage the WebSocket connection
	useEffect(() => {
		if (!hasActiveMatches) {
			wsRef.current?.close();
			wsRef.current = null;
			return;
		}

		if (wsRef.current) return; // already connected

		const ws = new WebSocket(SAMS_WS_URL);
		wsRef.current = ws;

		ws.onmessage = (event: MessageEvent<string>) => {
			let parsed: unknown;
			try {
				parsed = JSON.parse(event.data);
			} catch {
				return;
			}

			// Handle partial MATCH_UPDATE messages
			const result = SamsTickerWsMatchUpdateSchema.safeParse(parsed);
			if (result.success) {
				setLiveMatches((prev) => applyWsUpdate(prev, result.data));
			}
		};

		ws.onerror = () => {
			// WebSocket error — close and let React Query polling take over
			wsRef.current?.close();
			wsRef.current = null;
		};

		return () => {
			ws.close();
			wsRef.current = null;
		};
	}, [hasActiveMatches]);

	const activeMatches = liveMatches.filter((m) => m.started && !m.finished);
	if (activeMatches.length === 0) return null;

	return (
		<Box bg="onyx">
			<Container size="xl" px={{ base: "lg", md: "xl" }} py="md">
				<Stack>
					<Group gap="xs">
						<Badge color="red" variant="filled" size="lg" style={{ animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}>
							LIVE
						</Badge>
						<Title order={2} c="white">
							Wir spielen gerade!
						</Title>
					</Group>
					<Stack gap="sm">
						{activeMatches.map((match) => (
							<LiveMatchCard key={match.matchId} match={match} />
						))}
					</Stack>
				</Stack>
			</Container>
		</Box>
	);
}

function LiveMatchCard({ match }: { match: SamsLiveMatch }) {
	const currentSet = match.matchSets[match.matchSets.length - 1];

	return (
		<Card bg="dark.8" c="white" radius="md" withBorder style={{ borderColor: "var(--mantine-color-dark-4)" }}>
			<Stack gap="xs">
				{/* League */}
				<Text c="dimmed" size="sm">
					{match.leagueName}
				</Text>

				{/* Teams + set score */}
				<Group justify="space-between" align="center" gap="md">
					<Stack gap={0} style={{ flex: 1 }}>
						<Text fw="bold" size="lg">
							{match.homeTeamName}
						</Text>
						<Text c="dimmed" size="xs">
							Heimmannschaft
						</Text>
					</Stack>

					<Stack gap={2} align="center" style={{ minWidth: 80 }}>
						<Group gap={4} align="center">
							<Text fw="bold" size="xl" c="lion">
								{match.setPoints.team1}
							</Text>
							<Text c="dimmed" size="lg">
								:
							</Text>
							<Text fw="bold" size="xl" c="lion">
								{match.setPoints.team2}
							</Text>
						</Group>
						<Text c="dimmed" size="xs">
							Sätze
						</Text>
					</Stack>

					<Stack gap={0} align="flex-end" style={{ flex: 1 }}>
						<Text fw="bold" size="lg">
							{match.guestTeamName}
						</Text>
						<Text c="dimmed" size="xs">
							Gast
						</Text>
					</Stack>
				</Group>

				{/* Current set ball score */}
				{currentSet && !match.finished && (
					<Group justify="center">
						<Text c="white" size="sm">
							Satz {currentSet.setNumber}: {currentSet.setScore.team1} : {currentSet.setScore.team2}
						</Text>
					</Group>
				)}
			</Stack>
		</Card>
	);
}
