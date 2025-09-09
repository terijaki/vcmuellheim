import { Anchor, Container, Flex, Group, Text } from "@mantine/core";
import Socials from "@/components/layout/Socials";

const legals = [
	{ name: "Satzung", url: "/satzung" },
	{ name: "Beitragsordnung", url: "/beitragsordnung" },
	{ name: "Datenschutz", url: "/datenschutz" },
	{ name: "Impressum", url: "/impressum" },
];

export default function Footer() {
	return (
		<Container fluid bg="white" m={0}>
			<Container size="xl">
				<Group justify="space-between" wrap="nowrap" py="sm">
					<Flex columnGap="sm" wrap="wrap" direction={{ base: "column", sm: "row" }}>
						{legals.map((legal) => (
							<Anchor key={legal.name} href={legal.url} size="xs" c="dimmed" underline="never">
								{legal.name}
							</Anchor>
						))}
					</Flex>
					<Flex columnGap="sm" wrap="wrap" direction={{ base: "column", sm: "row" }}>
						{Socials().map((social) => (
							<Anchor key={social.name} {...social} size="xs" c="dimmed" underline="never">
								<Group gap={4}>
									{social.icon}
									<Text>{social.name}</Text>
								</Group>
							</Anchor>
						))}
					</Flex>
				</Group>
			</Container>
		</Container>
	);
}
