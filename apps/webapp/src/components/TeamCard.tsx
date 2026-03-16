import { ActionIcon, Anchor, Box, Button, Card, Collapse, Group, Stack, Text, Title } from "@mantine/core";
import dayjs from "dayjs";
import de from "dayjs/locale/de";
import weekday from "dayjs/plugin/weekday";
import { Fragment, useEffect, useState } from "react";
import { FaCalendarDays as IconCalendar, FaClock as IconClock, FaChevronUp as IconCollapse, FaEnvelope as IconMail, FaUser as IconPerson, FaUserGroup as IconPersons } from "react-icons/fa6";
import type { Team } from "@/lib/db";
import { Club } from "@/project.config";
import { useLocations, useMembers } from "../lib/hooks";
import { ButtonLink } from "./CustomLink";
import { useTeamContext } from "./context/HomeTeamContext";
import MapsLink from "./MapsLink";

dayjs.locale(de);
dayjs.extend(weekday);

export default function TeamCard(props: Team) {
	const { id, slug, name, league, sbvvTeamId, ageGroup, description, trainingSchedules, gender, trainerIds, pointOfContactIds } = props;

	const teamContext = useTeamContext();
	const { data: members } = useMembers();
	const { data: locations } = useLocations();

	const coaches = members?.items.filter((member) => trainerIds?.includes(member.id));
	const contactPeople = members?.items.filter((member) => pointOfContactIds?.includes(member.id));

	const isEmptyLeague = !teamContext.leagueParticipation;
	const isMatchingLeague = Boolean(isEmptyLeague || Boolean(league));
	const isEmptyGender = !teamContext.gender;
	const isMatchingGender = Boolean(isEmptyGender || teamContext.gender === gender);
	const isEmptyBoth = isEmptyLeague && isEmptyGender;
	const isMatching = Boolean(!isEmptyBoth && isMatchingLeague && isMatchingGender);

	const [isOpen, setIsOpen] = useState(isMatching);

	useEffect(() => {
		setIsOpen(isMatching);
	}, [isMatching]);

	const emailAddresses = new Map<string, string>();

	const fullOpacity = isOpen || isMatching || isEmptyBoth;

	return (
		<Card data-team-id={id} bg="white" style={{ opacity: fullOpacity ? 1 : 0.75 }}>
			<Group onClick={() => setIsOpen(!isOpen)} style={{ cursor: "pointer" }} wrap="nowrap" justify="space-between" align="flex-start">
				<Title order={3} c="blumine">
					{league ? `${name} - ${league}` : name}
				</Title>
				<ActionIcon variant="transparent">
					<IconCollapse
						style={{
							transform: isOpen ? "rotate(-180deg)" : "rotate(0deg)",
							transition: "transform 200ms",
						}}
					/>
				</ActionIcon>
			</Group>

			<Collapse in={isOpen}>
				<Stack>
					{ageGroup && (
						<Group gap="xs">
							<Text fw="bold">Alter:</Text>
							<Text>{ageGroup}</Text>
						</Group>
					)}
					{description && (
						<Stack gap={0}>
							<Text fw="bold">Info:</Text>
							<Text>{description}</Text>
						</Stack>
					)}
					{trainingSchedules && trainingSchedules.length > 0 && (
						<Stack gap={0}>
							<Group gap="xs" fw="bold">
								<IconClock />
								Trainingszeiten:
							</Group>
							{trainingSchedules.map((schedule) => {
								const separator = schedule.days.length > 2 ? ", " : " & ";
								const location = locations?.items.find((loc) => loc.id === schedule.locationId);
								const weekdayNames = schedule.days
									.map((d) => {
										return `${dayjs().weekday(d).format("dddd")}s`;
									})
									.join(separator);
								return (
									<Fragment key={schedule.days.join("-")}>
										<Text>
											{weekdayNames} {schedule.startTime} - {schedule.endTime} Uhr
										</Text>
										{location && <MapsLink {...location} />}
									</Fragment>
								);
							})}
						</Stack>
					)}
					{coaches && coaches.length > 0 && (
						<Stack gap={0}>
							<Group gap="xs" fw="bold">
								{coaches.length === 1 ? <IconPerson /> : <IconPersons />}
								Trainer:
							</Group>
							<Box>
								{coaches?.map((trainer, index) => {
									if (typeof trainer !== "object") return null;
									if (trainer.email) emailAddresses.set(trainer.email, trainer.email);
									return (
										<Fragment key={trainer.name}>
											{index !== 0 && " & "}
											{trainer.email ? (
												<Anchor component="a" href={`mailto:${trainer.email}`} underline="never">
													{trainer.name}
												</Anchor>
											) : (
												trainer.name
											)}
										</Fragment>
									);
								})}
							</Box>
						</Stack>
					)}
					{contactPeople && contactPeople.length > 0 && (
						<Stack gap={0}>
							<Group gap="xs" fw="bold">
								{contactPeople.length === 1 ? <IconPerson /> : <IconPersons />}
								{contactPeople.length === 1 ? "Ansprechperson" : "Ansprechpersonen"}:
							</Group>
							<Box>
								{contactPeople?.map((person, index) => {
									if (typeof person !== "object") return null;
									if (person.email) emailAddresses.set(person.email, person.email);
									return (
										<Fragment key={person.name}>
											{index !== 0 && " & "}
											{person.email ? (
												<Anchor component="a" href={`mailto:${person.email}`} underline="never">
													{person.name}
												</Anchor>
											) : (
												person.name
											)}
										</Fragment>
									);
								})}
							</Box>
						</Stack>
					)}

					<Stack gap="xs" mt="xs">
						{emailAddresses.size > 0 && (
							<Button component="a" href={`mailto:${Array.from(emailAddresses.values()).join(",")}?subject=${name} (${Club.shortName})`} color="turquoise" leftSection={<IconMail />}>
								Kontaktieren
							</Button>
						)}

						{sbvvTeamId && (
							<ButtonLink to={"/teams/$slug"} params={{ slug }} leftSection={<IconCalendar />}>
								Spielplan, Tabelle & Kader
							</ButtonLink>
						)}
					</Stack>
				</Stack>
			</Collapse>
		</Card>
	);
}
