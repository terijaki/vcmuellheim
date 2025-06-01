import type { Member } from "@/data/payload-types";
import { Card, Center, Group, Stack, Text } from "@mantine/core";
import Image from "next/image";
import Link from "next/link";
import { FaUser as IconAvatar } from "react-icons/fa6";

export default async function MemberCard({
	member,
	show,
	dark,
}: { member: Member; show?: "roles" | "email" | "phone"; dark?: boolean }) {
	const { id, name, email, phone, avatar, roles } = member;

	const roleNames = roles?.map((role) => (typeof role === "object" ? role.name : role));
	const avatarUrl = avatar && typeof avatar === "object" ? avatar.url : avatar;

	return (
		<Card
			component={Link}
			data-member-id={id}
			href={email ? `mailto:${email}` : ""}
			scroll={false}
			p={0}
			withBorder
			bg={dark ? "onyx" : undefined}
		>
			<Stack gap={0}>
				<Group gap={0}>
					<Stack bg={dark ? "blumine" : "lion"} w={58} h={64} c="white" pos="relative" align="center" justify="center">
						{avatarUrl ? (
							<Image fill src={avatarUrl} alt={name} style={{ objectFit: "cover" }} />
						) : (
							<IconAvatar width={"100%"} height={"100%"} />
						)}
					</Stack>
					<Text w={150} p="xs" lineClamp={2} lh="xs" c={dark ? "white" : undefined} fw={dark ? "bold" : undefined}>
						{name}
					</Text>
				</Group>
				{show === "roles" && roles && (
					<Center p={2} c="white" bg="blumine">
						<Text size="xs">{roleNames?.join(", ")}</Text>
					</Center>
				)}
				{show === "phone" && phone && (
					<Center p={2} c="white" bg="blumine">
						<Text size="xs">{phone}</Text>
					</Center>
				)}
				{show === "email" && email && (
					<Center p={2} c="white" bg="blumine">
						<Text size="xs">{email}</Text>
					</Center>
				)}
			</Stack>
		</Card>
	);
}
