import { Card, Center, Group, Image, Stack, Text } from "@mantine/core";
import { FaUser as IconAvatar } from "react-icons/fa6";
import type { Member } from "../../../../lib/db/types";
import { useFileUrl } from "../lib/hooks";

export default function MemberCard({ member, show, dark }: { member: Member; show?: "roles" | "email" | "phone"; dark?: boolean }) {
	const { id, name, email, phone, avatarS3Key, roleTitle } = member;
	const { data: avatarUrl } = useFileUrl(avatarS3Key);
	return (
		<Card component="a" data-member-id={id} href={email ? `mailto:${email}` : ""} p={0} withBorder bg={dark ? "onyx" : undefined}>
			<Stack gap={0}>
				<Group gap={0}>
					<Stack bg={dark ? "blumine" : "lion"} w={58} h={64} c="white" pos="relative" align="center" justify="center">
						{avatarUrl ? <Image src={avatarUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <IconAvatar width={"100%"} height={"100%"} />}
					</Stack>
					<Text w={150} p="xs" lineClamp={2} lh="xs" c={dark ? "white" : undefined} fw={dark ? "bold" : undefined}>
						{name}
					</Text>
				</Group>
				{show === "roles" && roleTitle && (
					<Center p={2} c="white" bg="blumine">
						<Text size="xs">{roleTitle}</Text>
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
