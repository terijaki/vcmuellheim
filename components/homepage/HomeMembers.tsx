import { Container, Group, Stack } from "@mantine/core";
import SectionHeading from "@/components/layout/SectionHeading";
import { getMembers } from "@/data/members";
import type { Member, Role } from "@/data/payload-types";
import { shuffleArray } from "@/utils/shuffleArray";
import MemberCard from "../MemberCard";
import ScrollAnchor from "./ScrollAnchor";

export default async function HomeMembers() {
	// get the data
	const members = await getMembers();
	if (!members) return null;

	// split members by role
	const isBoardMember = (role: string | Role) => typeof role === "object" && role.vorstand === true;
	const isTrainer = (role: string | Role) => typeof role === "object" && role.name.toLowerCase().includes("trainer");
	const boardMembers = members?.docs
		.map((member) => ({
			...member,
			roles: member.roles?.filter(isBoardMember),
		}))
		.filter((member) => member.roles && member.roles.length > 0)
		.sort((a, b) => {
			if (a.roles && b.roles && typeof a.roles[0] === "object" && typeof b.roles[0] === "object") {
				return a.roles[0].name.localeCompare(b.roles[0].name);
			}
			return 0;
		});
	const trainers = members?.docs
		.map((member) => ({
			...member,
			roles: member.roles?.filter(isTrainer),
		}))
		.filter((member) => member.roles && member.roles.length > 0);

	const otherMembers = members?.docs
		.map((member) => ({
			...member,
			roles: member.roles?.filter((role) => !isTrainer(role) && !isBoardMember(role)),
		}))
		.filter((member) => member.roles && member.roles.length > 0);

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
			{members?.map((member) => {
				return <MemberCard key={member.id} member={member} show={showRole ? "roles" : undefined} />;
			})}
		</Group>
	);
}
