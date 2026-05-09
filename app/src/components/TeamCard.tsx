import { Accordion, Anchor, Box, Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import { Club } from "@project.config";
import dayjs from "dayjs";
import de from "dayjs/locale/de";
import weekday from "dayjs/plugin/weekday";
import { Fragment, useEffect, useState } from "react";
import {
  FaCalendarDays,
  FaClock,
  FaEnvelope,
  FaUser,
  FaUserGroup,
  FaChevronDown,
} from "react-icons/fa6";
import type { Team } from "@/lib/db/types";
import { useLocations, useMembers } from "../hooks/dataQueries";
import { ButtonLink } from "./CustomLink";
import { useTeamContext } from "./context/HomeTeamContext";
import MapsLink from "./MapsLink";

dayjs.locale(de);
dayjs.extend(weekday);

export default function TeamCard(props: Team) {
  const {
    id,
    slug,
    name,
    league,
    sbvvTeamId,
    ageGroup,
    description,
    trainingSchedules,
    gender,
    trainerIds,
    pointOfContactIds,
  } = props;

  const teamContext = useTeamContext();
  const { data: members } = useMembers();
  const { data: locations } = useLocations();

  const coaches = trainerIds
    ?.map((id) => members?.items.find((member) => member.id === id))
    .filter(Boolean);
  const contactPeople = pointOfContactIds
    ?.map((id) => members?.items.find((member) => member.id === id))
    .filter(Boolean);

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
    <Card data-team-id={id} bg="white" p={0} style={{ opacity: fullOpacity ? 1 : 0.75 }}>
      <Accordion
        value={isOpen ? id : null}
        onChange={(val) => setIsOpen(val === id)}
        styles={{
          control: {
            paddingInline: "var(--mantine-spacing-md)",
            paddingBlock: "var(--mantine-spacing-md)",
          },
          label: { padding: 0 },
          panel: {
            paddingInline: "var(--mantine-spacing-md)",
            paddingBottom: "var(--mantine-spacing-md)",
          },
          content: { padding: 0 },
          chevron: { color: "var(--mantine-color-blumine-6)" },
        }}
        chevron={<FaChevronDown />}
      >
        <Accordion.Item value={id} style={{ border: "none" }}>
          <Accordion.Control style={{ backgroundColor: "transparent" }}>
            <Title order={3} c="blumine">
              {league ? `${name} - ${league}` : name}
            </Title>
          </Accordion.Control>
          <Accordion.Panel>
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
                    <FaClock />
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
                        {location && (
                          <MapsLink
                            name={location.name}
                            street={location.street}
                            postal={location.postal}
                            city={location.city}
                          />
                        )}
                      </Fragment>
                    );
                  })}
                </Stack>
              )}
              {coaches && coaches.length > 0 && (
                <Stack gap={0}>
                  <Group gap="xs" fw="bold">
                    {coaches.length === 1 ? <FaUser /> : <FaUserGroup />}
                    Trainer:
                  </Group>
                  <Box>
                    {coaches?.map((trainer, index) => {
                      if (typeof trainer !== "object") return null;
                      if (trainer.proxyEmail)
                        emailAddresses.set(trainer.proxyEmail, trainer.proxyEmail);
                      return (
                        <Fragment key={trainer.name}>
                          {index !== 0 && " & "}
                          {trainer.proxyEmail ? (
                            <Anchor
                              component="a"
                              href={`mailto:${trainer.proxyEmail}`}
                              underline="never"
                            >
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
                    {contactPeople.length === 1 ? <FaUser /> : <FaUserGroup />}
                    {contactPeople.length === 1 ? "Ansprechperson" : "Ansprechpersonen"}:
                  </Group>
                  <Box>
                    {contactPeople?.map((person, index) => {
                      if (typeof person !== "object") return null;
                      if (person.proxyEmail)
                        emailAddresses.set(person.proxyEmail, person.proxyEmail);
                      return (
                        <Fragment key={person.name}>
                          {index !== 0 && " & "}
                          {person.proxyEmail ? (
                            <Anchor
                              component="a"
                              href={`mailto:${person.proxyEmail}`}
                              underline="never"
                            >
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
                    component="a"
                    href={`mailto:${Array.from(emailAddresses.values()).join(",")}?subject=${name} (${Club.shortName})`}
                    color="turquoise"
                    leftSection={<FaEnvelope />}
                  >
                    Kontaktieren
                  </Button>
                )}

                {sbvvTeamId && (
                  <ButtonLink
                    to={"/teams/$slug"}
                    params={{ slug }}
                    leftSection={<FaCalendarDays />}
                  >
                    Spielplan, Tabelle & Kader
                  </ButtonLink>
                )}
              </Stack>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Card>
  );
}
