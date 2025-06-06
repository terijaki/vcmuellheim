import CardTitle from "@/components/CardTitle";
import CenteredLoader from "@/components/CenteredLoader";
import ImageGallery from "@/components/ImageGallery";
import MapsLink from "@/components/MapsLink";
import Matches from "@/components/Matches";
import RankingTable from "@/components/RankingTable";
import PageWithHeading from "@/components/layout/PageWithHeading";
import type { Member, Team } from "@/data/payload-types";
import { samsPlayers } from "@/data/sams/players";
import { samsLeagueMatches, samsLeagueRanking } from "@/data/sams/sams-server-actions";
import { getTeams } from "@/data/teams";
import { Club } from "@/project.config";
import { Anchor, Avatar, Button, Card, CardSection, Center, Flex, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import dayjs from "dayjs";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FaBullhorn as IconSubscribe } from "react-icons/fa6";
import Flag from "react-world-flags";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
	const { slug } = await params;
	const data = await getTeams(slug);
	return {
		title: data?.docs?.[0]?.name || Club.shortName,
	};
}

export default async function TeamPage(props: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ preview: "true" | "false" | undefined }>;
}) {
	const { slug } = await props.params;
	const searchParams = await props.searchParams;
	const preview = searchParams.preview === "true";

	const teams = await getTeams(slug, undefined, preview);
	const team = teams?.docs?.[0];
	if (!team) notFound(); // redirect to 404 page

	const samsTeam = typeof team.sbvvTeam === "object" ? team.sbvvTeam : undefined;
	const samsTeamUuid = samsTeam?.uuid;
	const leagueUuid = samsTeam?.leagueUuid;
	const leagueName = samsTeam?.leagueName; // injected in the ranking query
	const seasonName = samsTeam?.seasonName; // injected in the ranking query

	// team images
	const imageUrls =
		team?.images
			?.filter((media): media is NonNullable<typeof media> & { url: string } =>
				Boolean(typeof media === "object" && media?.url),
			)
			.map((image) => image.url) || [];

	return (
		<PageWithHeading title={team.name} subtitle={team.league || undefined}>
			{/* {team.name && leagueName && <PageHeading title={team.name} subtitle={leagueName} />} */}
			<Stack>
				{/* display players */}
				{/* <Suspense fallback={<CenteredLoader />}>
					<TeamPlayers seasonTeamId={seasonTeamId} />
				</Suspense> */}
				<Suspense fallback={<CenteredLoader />}>
					<TeamSchedule schedules={team.schedules} />
				</Suspense>
				<Suspense fallback={<CenteredLoader />}>
					<TeamTrainers people={team.people} />
				</Suspense>
				<Suspense fallback={<CenteredLoader />}>
					<TeamPictures images={imageUrls} />
				</Suspense>
				<Suspense fallback={<CenteredLoader />}>
					<TeamRanking
						leagueUuid={leagueUuid}
						leagueName={leagueName}
						seasonName={seasonName}
						teamUuid={samsTeamUuid}
					/>
				</Suspense>
				<Suspense fallback={<CenteredLoader />}>
					<TeamMatches leagueUuid={leagueUuid} teamUuid={samsTeamUuid} slug={slug} />
				</Suspense>
				<Center>
					<Button component={Link} href="/#mannschaften">
						zu den anderen Mannschaften
					</Button>
				</Center>
			</Stack>
		</PageWithHeading>
	);
}

async function TeamPlayers({ seasonTeamId }: { seasonTeamId?: string | number | null }) {
	"use cache";

	if (!seasonTeamId) return null;
	// retrive players
	const teamPlayers = await samsPlayers(seasonTeamId);
	const players = teamPlayers?.players;
	if (!players || players.length === 0) return null;

	const playersWithoutNumber = players.filter((player) => !player.number || player.number === 0);

	// sort players by numbers if every player has a number. otherwise sort by lastname
	players.sort((a, b) => {
		if (playersWithoutNumber.length === 0) return (a.number || 0) - (b.number || 0);
		return a.lastName.localeCompare(b.lastName);
	});

	return (
		<Card data-section="players">
			<Stack>
				<CardTitle>Spieler</CardTitle>
				<SimpleGrid cols={{ base: 1, xs: 2, md: 3, lg: 4 }}>
					{players.map((player, index) => {
						return (
							<Group key={`${player.lastName}${player.firstName}${index}`} gap="xs" wrap="nowrap">
								<Text w={16} miw={16} ta="center">
									{player.number}
								</Text>

								<Card p={0} shadow="xs" radius="xs" miw={32}>
									<Flag code={player.nationality} />
								</Card>

								<Text lineClamp={2} style={{ textWrap: "balance" }}>
									{player.firstName} {player.lastName}
								</Text>
							</Group>
						);
					})}
				</SimpleGrid>
			</Stack>
		</Card>
	);
}

async function TeamMatches({
	leagueUuid,
	teamUuid,
	slug,
}: { leagueUuid?: string | null; teamUuid?: string | null; slug: string }) {
	if (!leagueUuid || !teamUuid) return null;

	const matches = await samsLeagueMatches({ team: teamUuid, league: leagueUuid });

	const futureMatches = matches?.matches.filter((m) => m.results?.winner === null);
	const pastMatches = matches?.matches.filter((m) => m.results?.winner !== null);

	// check if its currently a month outside of the season (september to April)
	const currentMonth = dayjs().month() + 1;
	const isOffSeason = currentMonth >= 5 && currentMonth <= 9;

	// webcal link
	const headersList = await headers();
	const host = process.env.NODE_ENV === "development" && headersList.get("host");
	const webcalLink = `webcal://${host || Club.domain}/ics/${slug}.ics`;

	if (!futureMatches && !pastMatches)
		return (
			<Card>
				<CardTitle>Keine Spieltermine gefunden</CardTitle>
				{isOffSeason && (
					<Text>Die Saison im Hallenvolleyball findet in der Regel in den Monaten von September bis April statt.</Text>
				)}
				<Text>
					<Anchor href={webcalLink} style={{ display: "inline-flex", gap: 4, alignItems: "baseline" }}>
						<IconSubscribe /> Abboniere unseren Kalender
					</Anchor>
					, um neue Termine saisonübergreifend automatisch in deiner Kalender-App zu empfangen.
				</Text>
			</Card>
		);

	return (
		<>
			<Card>
				<CardTitle>Mannschaftskalender</CardTitle>
				<Text>
					<Anchor href={webcalLink} style={{ display: "inline-flex", gap: 4, alignItems: "baseline" }}>
						<IconSubscribe /> Abboniere unseren Kalender
					</Anchor>
					, um neue Termine saisonübergreifend automatisch in deiner Kalender-App zu empfangen.
				</Text>
			</Card>
			{pastMatches && pastMatches.length > 0 && (
				<Card>
					<CardTitle>Ergebnisse</CardTitle>
					<CardSection p={{ base: undefined, sm: "sm" }}>
						<Matches type="past" matches={pastMatches} timestamp={matches?.timestamp} highlightTeamUuid={teamUuid} />
					</CardSection>
				</Card>
			)}
			{futureMatches && futureMatches.length > 0 ? (
				<Card>
					<CardTitle>Spielplan</CardTitle>
					<CardSection p={{ base: undefined, sm: "sm" }}>
						<Matches
							type="future"
							matches={futureMatches}
							timestamp={matches?.timestamp}
							highlightTeamUuid={teamUuid}
						/>
					</CardSection>
				</Card>
			) : (
				<Card>
					<CardTitle>Spielplan</CardTitle>
					<Text>Aktuell stehen keine weiteren Spieltermine für diese Saison an.</Text>
					{isOffSeason && (
						<Text>
							Die Saison im Hallenvolleyball findet in der Regel in den Monaten von September bis April statt.
						</Text>
					)}
				</Card>
			)}
		</>
	);
}

async function TeamRanking({
	leagueUuid,
	leagueName,
	seasonName,
	teamUuid,
}: { leagueUuid?: string | null; leagueName?: string | null; seasonName?: string | null; teamUuid?: string | null }) {
	if (!leagueUuid) return null;

	const ranking = await samsLeagueRanking(leagueUuid, leagueName, seasonName); //league/season names injected to be passed along with its response object
	if (!ranking) return null;

	return <RankingTable ranking={ranking} teams={[{ teamUuid }]} />;
}

function TeamSchedule({ schedules }: { schedules?: Team["schedules"] }) {
	if (!schedules || schedules.length === 0) return null;

	return (
		<Card>
			<Stack>
				<CardTitle>Trainingszeiten</CardTitle>
				<Flex columnGap="xl" rowGap="md" wrap="wrap">
					{schedules.map((schedule) => {
						const separator = schedule.day.length > 2 ? ", " : " & ";
						return (
							<Stack key={schedule.id} gap={0}>
								<Text>
									{schedule.day.join(separator)} {dayjs(schedule.time.startTime).format("HH:mm")} -{" "}
									{dayjs(schedule.time.endTime).format("HH:mm")} Uhr
								</Text>
								{typeof schedule.location === "object" && <MapsLink location={schedule.location} />}
							</Stack>
						);
					})}
				</Flex>
			</Stack>
		</Card>
	);
}

function TeamTrainers({ people }: { people?: Team["people"] }) {
	if (!people) {
		return (
			<Card>
				<Text>
					Bei Fragen und Interesse zu dieser Mannschaft, wende dich bitte an{" "}
					<Anchor href={"mailto:info@vcmuellheim.de"}>info@vcmuellheim.de</Anchor>
				</Text>
			</Card>
		);
	}
	let peopleCount = 0;
	if (people.coaches) peopleCount += people.coaches.length;
	if (people.contactPeople) peopleCount += people.contactPeople.length;
	if (peopleCount === 0) return null;

	function MemberList({ title, member }: { title: string; member: (string | Member)[] }) {
		if (!member || member.length === 0 || typeof member === "string") return null;

		return (
			<Stack>
				<CardTitle>{title}</CardTitle>
				<Flex wrap="wrap" gap="xl">
					{member?.map((coach) => {
						if (typeof coach !== "object") return null;
						const avatarUrl = typeof coach.avatar === "object" && coach.avatar?.url ? coach.avatar.url : undefined;
						const Person = () => (
							<Group key={coach.id} align="center">
								<Avatar src={avatarUrl} name={coach.name} />
								<Stack gap={0}>
									<Text fw="bold" c="turquoise">
										{coach.name}
									</Text>
									{coach.email && (
										<Text c="dimmed" size="xs">
											{coach.email}
										</Text>
									)}
								</Stack>
							</Group>
						);

						if (coach.email)
							return (
								<Anchor key={coach.id} href={`mailto:${coach.email}`} underline="never">
									<Person />
								</Anchor>
							);
						return <Person key={coach.id} />;
					})}
				</Flex>
			</Stack>
		);
	}

	return (
		<Card>
			<Flex wrap="wrap" columnGap="xl" rowGap="md">
				<MemberList title="Trainer" member={people.coaches || []} />
				<MemberList
					title={people.contactPeople && people.contactPeople.length > 0 ? "Ansprechpersonen" : "Ansprechperson"}
					member={people.contactPeople || []}
				/>
			</Flex>
		</Card>
	);
}

function TeamPictures({ images }: { images?: string[] }) {
	if (!images || images.length === 0) return null;
	return (
		<Card>
			<CardTitle>Team Fotos</CardTitle>
			<ImageGallery images={images} />
		</Card>
	);
}
