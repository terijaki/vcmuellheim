import SectionHeading from "@/components/layout/SectionHeading";
import { getMembers } from "@/data/members";
import type { Member, Role } from "@/data/payload-types";
import { shuffleArray } from "@/utils/shuffleArray";
import { Card, Center, Container, Group, Stack, Text } from "@mantine/core";
import Image from "next/image";
import Link from "next/link";
import { FaUser as IconAvatar } from "react-icons/fa6";
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
		.filter((member) => member.roles && member.roles.length > 0);
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
		<Container size="xl">
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
				return <MemberCard key={member.id} member={member} showRole={showRole} />;
			})}
		</Group>
	);
}

async function MemberCard({ member, showRole }: { member: Member; showRole?: boolean }) {
	const { id, name, email, avatar, roles } = member;

	const emailClass = !email ? " hover:cursor-default" : "";
	const roleNames = roles?.map((role) => (typeof role === "object" ? role.name : role));
	const avatarUrl = avatar && typeof avatar === "object" ? avatar.url : avatar;

	return (
		<Card component={Link} data-member-id={id} href={email ? `mailto:${email}` : ""} scroll={false} p={0}>
			<Stack gap={0}>
				<Group gap={0}>
					<Stack bg="lion" w={58} h={64} c="white" pos="relative" align="center" justify="center">
						{avatarUrl ? (
							<Image fill src={avatarUrl} alt={name} objectFit="cover" />
						) : (
							<IconAvatar width={"100%"} height={"100%"} />
						)}
					</Stack>
					<Text w={150} p="xs" lineClamp={2} lh="xs">
						{name}
					</Text>
				</Group>
				{showRole && roles && (
					<Center p={2} c="white" bg="blumine">
						<Text size="xs">{roleNames?.join(", ")}</Text>
					</Center>
				)}
			</Stack>
		</Card>
	);
}
