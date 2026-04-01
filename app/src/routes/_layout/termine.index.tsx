import { Anchor, Card, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import CardTitle from "@webapp/components/CardTitle";
import EventCard from "@webapp/components/EventCard";
import PageWithHeading from "@webapp/components/layout/PageWithHeading";
import Matches from "@webapp/components/Matches";
import { getUpcomingEventsFn } from "@webapp/server/functions/events";
import { getSamsMatchesFn } from "@webapp/server/functions/sams";
import { createWebcalLink } from "@webapp/utils/webcal";
import dayjs from "dayjs";
import { Fragment } from "react";
import { FaBullhorn as IconSubscribe } from "react-icons/fa6";

export const Route = createFileRoute("/_layout/termine/")({
	loader: async () => {
		const [eventsResult, matchesResult] = await Promise.allSettled([getUpcomingEventsFn(), getSamsMatchesFn({ data: { range: "future" } })]);

		const events = eventsResult.status === "fulfilled" ? eventsResult.value.items : [];
		const matches = matchesResult.status === "fulfilled" ? matchesResult.value : null;

		return { events, matches, matchesError: matchesResult.status === "rejected" };
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { events, matches, matchesError } = Route.useLoaderData();
	const webcalLink = createWebcalLink("/api/ics/all.ics");

	return (
		<PageWithHeading title="Termine" description="Alle Termine, Spieltage und Events von Volleyballclub Müllheim im Überblick">
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
				<EventsContent events={events} />
				<MatchesContent matches={matches} error={matchesError} />
			</Stack>
		</PageWithHeading>
	);
}

function EventsContent({ events }: { events: Awaited<ReturnType<typeof getUpcomingEventsFn>>["items"] }) {
	if (!events || events.length === 0) {
		return null;
	}

	return (
		<Card>
			<Title order={2} c="blumine">
				Veranstaltungen
			</Title>
			<SimpleGrid cols={{ base: 1, md: 2 }}>
				{events.map((event) => {
					return <EventCard {...event} key={event.id} />;
				})}
			</SimpleGrid>
		</Card>
	);
}

function MatchesContent({ matches, error }: { matches: Awaited<ReturnType<typeof getSamsMatchesFn>> | null; error: boolean }) {
	const currentMonth = dayjs().month() + 1;
	const isOffSeason = currentMonth >= 5 && currentMonth <= 9;

	if (error) {
		return (
			<Card>
				<CardTitle>Fehler beim Laden der SBVV Ligaspiele</CardTitle>
				<Text>Die Spieltermine konnten nicht geladen werden. Bitte versuche es später erneut.</Text>
			</Card>
		);
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
