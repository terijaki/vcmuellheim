import { Anchor, Avatar, Button, Card, CardSection, Center, Flex, Group, Stack, Text } from "@mantine/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { Suspense } from "react";
import { FaBullhorn as IconSubscribe } from "react-icons/fa6";
import { getIcsHostname } from "../../../shared/lib/api-url";
import CardTitle from "../components/CardTitle";
import CenteredLoader from "../components/CenteredLoader";
import ImageGallery from "../components/ImageGallery";
import PageWithHeading from "../components/layout/PageWithHeading";
import MapsLink from "../components/MapsLink";
import Matches from "../components/Matches";
import RankingTable from "../components/RankingTable";
import { useFileUrls, useLocations, useMembers, useSamsMatches, useSamsRankingsByLeagueUuid, useSamsTeams, useTeamBySlug } from "../lib/hooks";

export const Route = createFileRoute("/teams/$slug")({
	component: RouteComponent,
});

function RouteComponent() {
	const { slug } = Route.useParams();
	const { data: team, isLoading, error } = useTeamBySlug(slug);

	if (isLoading) {
		return (
			<PageWithHeading title="Mannschaft">
				<CenteredLoader text="Lade Mannschaftsdaten..." />
			</PageWithHeading>
		);
	}

	if (error || !team) {
		return (
			<PageWithHeading title="Mannschaft nicht gefunden">
				<Card>
					<CardTitle>Mannschaft nicht gefunden</CardTitle>
					<Text>Diese Mannschaft existiert nicht oder wurde entfernt.</Text>
				</Card>
			</PageWithHeading>
		);
	}

	return (
		<PageWithHeading title={team.name} subtitle={team.league || undefined}>
			<Stack>
				<Suspense fallback={<CenteredLoader text="Lade Trainingszeiten..." />}>
					<TeamSchedule team={team} />
				</Suspense>
				<Suspense fallback={<CenteredLoader text="Lade Trainer..." />}>
					<TeamTrainers team={team} />
				</Suspense>
				<Suspense fallback={<CenteredLoader text="Lade Fotos..." />}>
					<TeamPictures team={team} />
				</Suspense>
				<Suspense fallback={<CenteredLoader text="Lade Tabelle..." />}>
					<TeamRanking team={team} />
				</Suspense>
				<Suspense fallback={<CenteredLoader text="Lade Spielplan..." />}>
					<TeamCalendar slug={slug} team={team} />
				</Suspense>
				<Suspense fallback={<CenteredLoader text="Lade Spielplan..." />}>
					<TeamMatches team={team} />
				</Suspense>
				<Center>
					<Button component={Link} to="/#mannschaften">
						zu den anderen Mannschaften
					</Button>
				</Center>
			</Stack>
		</PageWithHeading>
	);
}

function TeamCalendar({ slug, team }: { slug: string; team: NonNullable<ReturnType<typeof useTeamBySlug>["data"]> }) {
	const { data: samsTeams } = useSamsTeams();
	const samsTeam = samsTeams?.teams.find((t) => t.uuid === team.sbvvTeamId);

	if (!samsTeam) return null;

	const icsHostname = getIcsHostname();
	const webcalLink = `webcal://${icsHostname}/ics/${slug}.ics`;

	return (
		<Card>
			<CardTitle>Mannschaftskalender</CardTitle>
			<Text>
				<Anchor href={webcalLink} style={{ display: "inline-flex", gap: 4, alignItems: "baseline" }}>
					<IconSubscribe /> Abboniere unseren Kalender
				</Anchor>
				, um neue Termine saisonübergreifend automatisch in deiner Kalender-App zu empfangen.
			</Text>
		</Card>
	);
}

function TeamMatches({ team }: { team: NonNullable<ReturnType<typeof useTeamBySlug>["data"]> }) {
	const { data: samsTeams } = useSamsTeams();
	const samsTeam = samsTeams?.teams.find((t) => t.uuid === team.sbvvTeamId);

	const { data: matches, isLoading: isLoadingMatches } = useSamsMatches({
		team: samsTeam?.uuid,
	});

	const currentMonth = dayjs().month() + 1;
	const isOffSeason = currentMonth >= 5 && currentMonth <= 9;

	if (isLoadingMatches) {
		return <CenteredLoader text="Lade Spieltermine..." />;
	}

	if (!isLoadingMatches && (!samsTeam || !matches)) {
		return (
			<Card>
				<CardTitle>Keine Spieltermine gefunden</CardTitle>
				{isOffSeason && <Text>Die Saison im Hallenvolleyball findet in der Regel in den Monaten von September bis April statt.</Text>}
			</Card>
		);
	}

	const futureMatches = matches?.matches.filter((m) => !m.results?.winner);
	const pastMatches = matches?.matches.filter((m) => !!m.results?.winner);

	futureMatches?.sort((a, b) => dayjs(a.date).diff(dayjs(b.date)));
	pastMatches?.sort((a, b) => dayjs(b.date).diff(dayjs(a.date)));

	return (
		<>
			{pastMatches && pastMatches.length > 0 && (
				<Card>
					<CardTitle>Ergebnisse</CardTitle>
					<CardSection p={{ base: undefined, sm: "sm" }}>
						<Matches type="past" matches={pastMatches} timestamp={matches?.timestamp ? new Date(matches.timestamp) : undefined} highlightTeamUuid={samsTeam?.uuid} uniqueLeague />
					</CardSection>
				</Card>
			)}
			{futureMatches && futureMatches.length > 0 ? (
				<Card>
					<CardTitle>Spielplan</CardTitle>
					<CardSection p={{ base: undefined, sm: "sm" }}>
						<Matches type="future" matches={futureMatches} timestamp={matches?.timestamp ? new Date(matches.timestamp) : undefined} highlightTeamUuid={samsTeam?.uuid} />
					</CardSection>
				</Card>
			) : (
				<Card>
					<CardTitle>Spielplan</CardTitle>
					<Text>Aktuell stehen keine weiteren Spieltermine für diese Saison an.</Text>
					{isOffSeason && <Text>Die Saison im Hallenvolleyball findet in der Regel in den Monaten von September bis April statt.</Text>}
				</Card>
			)}
		</>
	);
}

function TeamRanking({ team }: { team: NonNullable<ReturnType<typeof useTeamBySlug>["data"]> }) {
	const { data: samsTeams } = useSamsTeams();
	const samsTeam = samsTeams?.teams.find((t) => t.uuid === team.sbvvTeamId);

	const { data: rankings } = useSamsRankingsByLeagueUuid(samsTeam?.leagueUuid ? [samsTeam.leagueUuid] : []);

	if (!samsTeam || !rankings || rankings.length === 0) return null;

	const ranking = rankings[0];

	return <RankingTable ranking={ranking} currentTeamId={samsTeam.uuid} />;
}

function TeamSchedule({ team }: { team: NonNullable<ReturnType<typeof useTeamBySlug>["data"]> }) {
	const { data: locations } = useLocations();

	if (!team.trainingSchedules || team.trainingSchedules.length === 0) return null;

	const daysOfWeek = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

	return (
		<Card>
			<Stack>
				<CardTitle>Trainingszeiten</CardTitle>
				<Flex columnGap="xl" rowGap="md" wrap="wrap">
					{team.trainingSchedules.map((schedule) => {
						const location = locations?.items.find((loc) => loc.id === schedule.locationId);
						const dayNames = schedule.days.map((day) => daysOfWeek[day]);
						const separator = dayNames.length > 2 ? ", " : " & ";
						const scheduleKey = `${schedule.days.join("-")}-${schedule.startTime}-${schedule.endTime}`;

						return (
							<Stack key={scheduleKey} gap={0}>
								<Text>
									{dayNames.join(separator)} {schedule.startTime} - {schedule.endTime} Uhr
								</Text>
								{location && <MapsLink name={location.name} street={location.street} postal={location.postal} city={location.city} />}
							</Stack>
						);
					})}
				</Flex>
			</Stack>
		</Card>
	);
}

function TeamTrainers({ team }: { team: NonNullable<ReturnType<typeof useTeamBySlug>["data"]> }) {
	const { data: members } = useMembers();

	const trainers = members?.items.filter((m) => team.trainerIds?.includes(m.id));
	const contacts = members?.items.filter((m) => team.pointOfContactIds?.includes(m.id));

	const { data: avatarUrls } = useFileUrls([...(trainers?.map((t) => t.avatarS3Key).filter(Boolean) || []), ...(contacts?.map((c) => c.avatarS3Key).filter(Boolean) || [])] as string[]);

	if (!trainers?.length && !contacts?.length) {
		return (
			<Card>
				<Text>
					Bei Fragen und Interesse zu dieser Mannschaft, wende dich bitte an <Anchor href="mailto:info@vcmuellheim.de">info@vcmuellheim.de</Anchor>
				</Text>
			</Card>
		);
	}

	function MemberList({ title, memberList }: { title: string; memberList: typeof trainers }) {
		if (!memberList || memberList.length === 0) return null;

		return (
			<Stack>
				<CardTitle>{title}</CardTitle>
				<Flex wrap="wrap" gap="xl">
					{memberList.map((member) => {
						const avatarUrl = member.avatarS3Key ? avatarUrls?.[memberList.indexOf(member)] : undefined;
						const Person = () => (
							<Group key={member.id} align="center">
								<Avatar src={avatarUrl} name={member.name} />
								<Stack gap={0}>
									<Text fw="bold" c="turquoise">
										{member.name}
									</Text>
									{member.email && (
										<Text c="dimmed" size="xs">
											{member.email}
										</Text>
									)}
								</Stack>
							</Group>
						);

						if (member.email) {
							return (
								<Anchor key={member.id} href={`mailto:${member.email}`} underline="never">
									<Person />
								</Anchor>
							);
						}
						return <Person key={member.id} />;
					})}
				</Flex>
			</Stack>
		);
	}

	return (
		<Card>
			<Flex wrap="wrap" columnGap="xl" rowGap="md">
				<MemberList title="Trainer" memberList={trainers} />
				<MemberList title={contacts && contacts.length > 1 ? "Ansprechpersonen" : "Ansprechperson"} memberList={contacts} />
			</Flex>
		</Card>
	);
}

function TeamPictures({ team }: { team: NonNullable<ReturnType<typeof useTeamBySlug>["data"]> }) {
	const { data: imageUrls } = useFileUrls(team.pictureS3Keys || []);

	if (!team.pictureS3Keys || team.pictureS3Keys.length === 0) return null;

	return (
		<Card>
			<CardTitle>Team Fotos</CardTitle>
			<ImageGallery images={imageUrls || []} />
		</Card>
	);
}
