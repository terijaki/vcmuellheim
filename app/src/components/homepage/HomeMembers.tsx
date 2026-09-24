import type { PublicMember } from "@webapp/server/functions/members";
import { Container, Group, Skeleton, Stack } from "@mantine/core";
import { useMembers } from "../../hooks/dataQueries";
import SectionHeading from "../layout/SectionHeading";
import MemberCard from "../MemberCard";
import ScrollAnchor from "./ScrollAnchor";

export default function HomeMembers({
  initialMembers,
}: {
  initialMembers?: Awaited<ReturnType<typeof useMembers>>["data"];
} = {}) {
  const { data, isPending } = useMembers(
    initialMembers ? { initialData: initialMembers } : undefined,
  );
  if (isPending && !data) {
    return (
      <Container size="md" py="xl" px={{ base: "lg", md: "xl" }}>
        <Stack>
          <Skeleton height={28} width={180} />
          <Group>
            <Skeleton height={72} width={208} />
            <Skeleton height={72} width={208} />
          </Group>
        </Stack>
      </Container>
    );
  }
  const boardMembers = data?.board || [];
  const trainers = data?.trainers || [];
  const otherMembers = data?.officials || [];

  return (
    <Container size="md" py="xl" px={{ base: "lg", md: "xl" }}>
      <ScrollAnchor name="verein" />
      <Stack>
        {boardMembers.length > 0 && (
          <Stack>
            <SectionHeading text="Vorstand" />
            <MemberList members={boardMembers} showRole />
          </Stack>
        )}
        {trainers.length > 0 && (
          <Stack>
            <SectionHeading text="Trainer & Betreuer" />
            <MemberList members={trainers} />
          </Stack>
        )}
        {otherMembers.length > 0 && (
          <Stack>
            <SectionHeading text="Sonstige Funktionäre" />
            <MemberList members={otherMembers} showRole />
          </Stack>
        )}
      </Stack>
    </Container>
  );
}

function MemberList({ members, showRole }: { members: PublicMember[]; showRole?: boolean }) {
  return (
    <Group justify="center" align="stretch">
      {members?.map((member) => (
        <MemberCard key={member.id} member={member} show={showRole ? "roles" : undefined} />
      ))}
    </Group>
  );
}
