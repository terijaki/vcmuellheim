"use client";
import type { Team } from "@/data/payload-types";
import { ActionIcon, Anchor, Box, Card, Collapse, Group, Stack, Text, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import dayjs from "dayjs";
import Link from "next/link";
import { Fragment } from "react";
import {
	FaCalendarDays as IconCalendar,
	FaClock as IconClock,
	FaChevronUp as IconCollapse,
	FaUser as IconPerson,
	FaUserGroup as IconPersons,
} from "react-icons/fa6";
import MapsLink from "./MapsLink";

export default function TeamCard({ id, slug, name, league, age, description, schedule, people }: Team) {
	const [opened, { toggle }] = useDisclosure(false);

	return (
		<Card data-team-id={id} bg="white" miw={380} maw="98vw">
			<Group onClick={toggle} style={{ cursor: "pointer" }} wrap="nowrap" justify="space-between" align="flex-start">
				<Title order={3} c="blumine" className=" hover:text-turquoise">
					{league ? `${name} - ${league}` : name}
				</Title>
				<ActionIcon variant="transparent">
					<IconCollapse className={`duration-200 ${opened ? "-rotate-180" : ""} hover:animate-pulse`} />
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
					{schedule && (
						<Stack gap={0}>
							<Group gap="xs" fw="bold">
								<IconClock className="text-xs" />
								Trainingszeiten:
							</Group>
							{schedule?.map((training) => {
								const separator = training.day.length > 2 ? ", " : " & ";

								return (
									<Fragment key={training.id}>
										<Text>
											{training.day.join(separator)} {dayjs(training.time.startTime).format("HH:mm")} -{" "}
											{dayjs(training.time.endTime).format("HH:mm")} Uhr
										</Text>
										{typeof training.location === "object" && <MapsLink location={training.location} />}
									</Fragment>
								);
							})}
						</Stack>
					)}
					{people?.coach && people.coach.length >= 1 && (
						<Stack gap={0}>
							<Group gap="xs" fw="bold">
								{people.coach.length === 1 ? <IconPerson className="text-xs" /> : <IconPersons className="text-xs" />}
								Trainer:
							</Group>
							<Box>
								{people.coach?.map((trainer, index) => {
									if (typeof trainer !== "object") return null;
									return (
										<Fragment key={trainer.name}>
											{index !== 0 && " & "}
											{trainer.email ? (
												<Anchor component={Link} href={`mailto:${trainer.email}`} c="turquoise" scroll={false}>
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
					{people?.contactPerson && people.contactPerson && (
						<Stack gap={0}>
							<Group gap="xs" fw="bold">
								{people.contactPerson.length === 1 ? (
									<IconPerson className="text-xs" />
								) : (
									<IconPersons className="text-xs" />
								)}
								Ansprechperson:
							</Group>
							<Box>
								{people.contactPerson?.map((person, index) => {
									if (typeof person !== "object") return null;
									return (
										<Fragment key={person.name}>
											{index !== 0 && " & "}
											{person.email ? (
												<Anchor component={Link} href={`mailto:${person.email}`} c="turquoise" scroll={false}>
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

					{description && <Stack gap={0}>{description}</Stack>}
					{league && (
						<Stack gap={0}>
							<Group gap="xs" fw="bold">
								<IconCalendar className="text-xs" />
								Saisoninfo:
							</Group>
							<Anchor component={Link} href={`/teams/${slug}`} c="turquoise">
								Spielplan, Tabelle & Kader
							</Anchor>
						</Stack>
					)}
				</Stack>
			</Collapse>
		</Card>
	);
}
