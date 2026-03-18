import { Card, Center, Group, Image, Stack, Text } from "@mantine/core";
import { FaUser as IconAvatar } from "react-icons/fa6";
import type { Member } from "../../../../lib/db/types";
import { useFileUrl } from "../hooks/dataQueries";

export default function MemberCard({ member, show, dark }: { member: Member; show?: "roles" | "email" | "phone"; dark?: boolean }) {
	const { id, name, email, phone, avatarS3Key, roleTitle } = member;
	const { data: avatarUrl } = useFileUrl(avatarS3Key);
	return (
		<Card component="a" data-member-id={id} href={email ? `mailto:${email}` : ""} p={0} withBorder bg={dark ? "onyx" : undefined} w={{ base: "100%", xs: 208 }} maw={280} mih={72}>
			<Stack gap={0} h="100%">
				<Group gap={0} align="stretch" h="100%">
					<Stack bg={dark ? "blumine" : "lion"} w={{ base: 72, xs: 56 }} c="white" align="center" justify="center">
						{avatarUrl ? <Image src={avatarUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <IconAvatar width={"100%"} height={"100%"} size={32} />}
					</Stack>
					<Stack flex={1} gap={0} justify="space-around">
						<Stack flex={1} justify="center" p="xs">
							<Text lineClamp={2} c={dark ? "white" : undefined} fw={dark ? "bold" : undefined}>
								{name}
							</Text>
						</Stack>
						{show === "roles" && roleTitle && (
							<Center p={2} c="white" bg="blumine" display={{ base: "flex", xs: "none" }}>
								<Text size="xs">{roleTitle}</Text>
							</Center>
						)}
					</Stack>
				</Group>
				{show === "roles" && roleTitle && (
					<Center p={2} c="white" bg="blumine" display={{ base: "none", xs: "flex" }}>
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
