import type { Member } from "@lib/db/types";
import { Container, Group, Stack } from "@mantine/core";
import { shuffleArray } from "@utils/shuffleArray";
import { useMembers } from "../../lib/hooks";
import SectionHeading from "../layout/SectionHeading";
import MemberCard from "../MemberCard";
import ScrollAnchor from "./ScrollAnchor";

export default function HomeMembers() {
	const { data, isLoading } = useMembers();
	if (isLoading) return null;
	const members = data?.items || [];

	const boardMembers = members.filter((member) => member.isBoardMember);
	const trainers = members.filter((member) => member.isTrainer);
	const otherMembers = members.filter((member) => !member.isBoardMember && !member.isTrainer && member.roleTitle);

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
						<MemberList members={shuffleArray(trainers)} />
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

function MemberList({ members, showRole }: { members: Member[]; showRole?: boolean }) {
	return (
		<Group justify="center">
			{members?.map((member) => (
				<MemberCard key={member.id} member={member} show={showRole ? "roles" : undefined} />
			))}
		</Group>
	);
}
