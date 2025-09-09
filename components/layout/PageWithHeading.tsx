import { Container, Group, Stack } from "@mantine/core";
import PageHeading from "./PageHeading";

export default function PageWithHeading({ children, ...props }: Parameters<typeof PageHeading>[0] & { children: React.ReactNode }) {
	return (
		<Stack pb="md" bg="aquahaze" align="stretch">
			<PageHeading {...props} />

			<Group grow>
				<Container size="xl" px={{ base: "lg", md: "xl" }}>
					{children}
				</Container>
			</Group>
		</Stack>
	);
}
