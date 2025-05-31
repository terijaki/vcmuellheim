"use client";
import type { Team } from "@/data/payload-types";
import { Club } from "@/project.config";
import { ActionIcon, Anchor, Box, Button, Card, Collapse, Group, Stack, Text, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import dayjs from "dayjs";
import Link from "next/link";
import { Fragment, useEffect } from "react";
import {
	FaCalendarDays as IconCalendar,
	FaClock as IconClock,
	FaChevronUp as IconCollapse,
	FaEnvelope as IconMail,
	FaUser as IconPerson,
	FaUserGroup as IconPersons,
} from "react-icons/fa6";
import MapsLink from "./MapsLink";
import { useTeamContext } from "./context/HomeTeamContext";

export default function TeamCard(props: Team) {
	const { id, slug, name, league, sbvvTeam, age, description, schedules, people, gender } = props;

	const [opened, { toggle, open, close }] = useDisclosure(false);
	const teamContext = useTeamContext();
	const isMatchingLeague = Boolean(!teamContext.leagueParticipation || Boolean(league));
	const isEmptyGender = !teamContext.gender;
	const isMatchingGender = Boolean(isEmptyGender || teamContext.gender === gender);
	const isMatching = Boolean(isMatchingLeague && isMatchingGender);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		if (opened && (!isMatching || isEmptyGender)) close();
		if (!isEmptyGender && !opened && isMatching) open();
	}, [teamContext]);

	const emailAddresses = new Map<string, string>();

	return (
		<Card data-team-id={id} bg="white" style={{ opacity: isMatching || opened ? 1 : 0.75 }}>
			<Group onClick={toggle} style={{ cursor: "pointer" }} wrap="nowrap" justify="space-between" align="flex-start">
				<Title order={3} c="blumine">
					{league ? `${name} - ${league}` : name}
				</Title>
				<ActionIcon variant="transparent">
					<IconCollapse
						style={{
							transform: opened ? "rotate(-180deg)" : "rotate(0deg)",
							transition: "transform 200ms",
						}}
					/>
				</ActionIcon>
			</Group>

			<Collapse in={opened}>
				<Stack>
					{age && (
						<Group gap="xs">
							<Text fw="bold">Alter:</Text>
							<Text>ab {age} Jahre</Text>
						</Group>
					)}
					{description && (
						<Stack gap={0}>
							<Text fw="bold">Info:</Text>
							<Text size="sm">{description}</Text>
						</Stack>
					)}
					{schedules && schedules.length > 0 && (
						<Stack gap={0}>
							<Group gap="xs" fw="bold">
								<IconClock />
								Trainingszeiten:
							</Group>
							{schedules.map((schedule) => {
								const separator = schedule.day.length > 2 ? ", " : " & ";

								return (
									<Fragment key={schedule.id}>
										<Text>
											{schedule.day.join(separator)} {dayjs(schedule.time.startTime).format("HH:mm")} -{" "}
											{dayjs(schedule.time.endTime).format("HH:mm")} Uhr
										</Text>
										{typeof schedule.location === "object" && <MapsLink location={schedule.location} />}
									</Fragment>
								);
							})}
						</Stack>
					)}
					{people?.coaches && people.coaches.length > 0 && (
						<Stack gap={0}>
							<Group gap="xs" fw="bold">
								{people.coaches.length === 1 ? <IconPerson /> : <IconPersons />}
								Trainer:
							</Group>
							<Box>
								{people.coaches?.map((trainer, index) => {
									if (typeof trainer !== "object") return null;
									if (trainer.email) emailAddresses.set(trainer.email, trainer.email);
									return (
										<Fragment key={trainer.name}>
											{index !== 0 && " & "}
											{trainer.email ? (
												<Anchor component={Link} href={`mailto:${trainer.email}`} underline="never" scroll={false}>
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
					{people?.contactPeople && people.contactPeople.length > 0 && (
						<Stack gap={0}>
							<Group gap="xs" fw="bold">
								{people.contactPeople.length === 1 ? <IconPerson /> : <IconPersons />}
								{people.contactPeople.length === 1 ? "Ansprechperson" : "Ansprechpersonen"}:
							</Group>
							<Box>
								{people.contactPeople?.map((person, index) => {
									if (typeof person !== "object") return null;
									if (person.email) emailAddresses.set(person.email, person.email);
									return (
										<Fragment key={person.name}>
											{index !== 0 && " & "}
											{person.email ? (
												<Anchor component={Link} href={`mailto:${person.email}`} underline="never" scroll={false}>
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
							<Button
								component={Link}
								href={`mailto:${Array.from(emailAddresses.values()).join(",")}?subject=${name} (${Club.shortName})`}
								color="turquoise"
								leftSection={<IconMail />}
							>
								Kontaktieren
							</Button>
						)}
						{sbvvTeam && (
							<Button component={Link} href={`/teams/${slug}`} leftSection={<IconCalendar />}>
								Spielplan, Tabelle & Kader
							</Button>
						)}
					</Stack>
				</Stack>
			</Collapse>
		</Card>
	);
}
