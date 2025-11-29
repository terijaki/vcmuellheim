import { Anchor, Card, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import { Fragment, Suspense } from "react";
import { FaBullhorn as IconSubscribe } from "react-icons/fa6";
import { Club } from "@/project.config";
import CardTitle from "../components/CardTitle";
import CenteredLoader from "../components/CenteredLoader";
import EventCard from "../components/EventCard";
import PageWithHeading from "../components/layout/PageWithHeading";
import Matches from "../components/Matches";
import { useEvents, useSamsMatches } from "../lib/hooks";

export const Route = createFileRoute("/termine")({
	component: RouteComponent,
});

function RouteComponent() {
	// Construct webcal link - in new architecture, determine hostname dynamically
	const hostname = typeof window !== "undefined" ? window.location.hostname : Club.domain;
	const webcalLink = `webcal://${hostname}/ics/all.ics`;

	return (
		<PageWithHeading title="Termine">
			<Stack>
				<Card>
					<Stack>
						<CardTitle>Kalender Integration</CardTitle>
						<Text>
							<Anchor href={webcalLink} style={{ display: "inline-flex", gap: 4 }}>
								<IconSubscribe /> Abboniere unseren Vereinskalender
							</Anchor>
							, um neue Termine saisonübergreifend automatisch in deiner{" "}
							<Text fw="bold" span>
								Kalender-App
							</Text>{" "}
							zu empfangen.
						</Text>
					</Stack>
				</Card>
				<Suspense fallback={<CenteredLoader text="Lade Termine..." />}>
					<EventsContent />
					<MatchesContent />
				</Suspense>
			</Stack>
		</PageWithHeading>
	);
}

function EventsContent() {
	const { data: events, isLoading } = useEvents();

	if (isLoading) {
		return <CenteredLoader text="Lade Veranstaltungen..." />;
	}

	if (!events?.items || events.items.length === 0) {
		return null;
	}

	return (
		<Card>
			<Title order={2} c="blumine">
				Veranstaltungen
			</Title>
			<SimpleGrid cols={{ base: 1, md: 2 }}>
				{events.items.map((event) => {
					return <EventCard {...event} key={event.id} />;
				})}
			</SimpleGrid>
		</Card>
	);
}

function MatchesContent() {
	const { data: matches, isLoading } = useSamsMatches({ range: "future" });

	const currentMonth = dayjs().month() + 1;
	const isOffSeason = currentMonth >= 5 && currentMonth <= 9;

	if (isLoading) {
		return <CenteredLoader text="Lade Ligaspiele..." />;
	}

	if (matches?.matches && matches.matches.length > 0) {
		const timestampDate = matches.timestamp ? new Date(matches.timestamp) : undefined;
		return (
			<Card>
				<Title order={2} c="blumine">
					Ligaspiele
				</Title>
				<Matches matches={matches.matches} timestamp={timestampDate} type="future" />
			</Card>
		);
	}

	// Fallback when no matches
	return (
		<Fragment>
			<Card>
				<CardTitle>Keine Ligaspiele</CardTitle>
				<Text>Derzeit stehen keine weiteren Spieltermine an.</Text>
			</Card>
			{isOffSeason && (
				<Card>
					<CardTitle>Außerhalb der Saison?</CardTitle>
					<Text>
						Die Saison im Hallenvolleyball findet in der Regel in den Monaten von September bis April statt. Dazwischen wird die nächste Saison vorbereitet und die neusten Informationen vom
						Südbadischen Volleyballverband wurden ggf. noch nicht veröffentlicht.
					</Text>
				</Card>
			)}
		</Fragment>
	);
}
