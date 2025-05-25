import Socials from "@/components/layout/Socials";
import { Container, Flex, Group, Text } from "@mantine/core";
import Link from "next/link";

const legals = [
	{ name: "Satzung", url: "/satzung" },
	{ name: "Beitragsordnung", url: "/beitragsordnung" },
	{ name: "Datenschutz", url: "/datenschutz" },
	{ name: "Impressum", url: "/impressum" },
];

export default function Footer() {
	return (
		<Container fluid bg="white" m={0} c="dimmed">
			<Container size="xl">
				<Group justify="space-between" wrap="nowrap" py="sm">
					<Flex columnGap="sm" wrap="wrap" direction={{ base: "column", sm: "row" }}>
						{legals.map((legal) => (
							<Link key={legal.name} href={legal.url} className=" hover:text-turquoise">
								<Text size="sm">{legal.name}</Text>
							</Link>
						))}
					</Flex>
					<Flex columnGap="sm" wrap="wrap" direction={{ base: "column", sm: "row" }}>
						{Socials().map((social) => (
							<Link key={social.name} {...social} className=" hover:text-turquoise">
								<Group>
									{social.icon}
									<Text size="sm">{social.name}</Text>
								</Group>
							</Link>
						))}
					</Flex>
				</Group>
			</Container>
		</Container>
	);
}
