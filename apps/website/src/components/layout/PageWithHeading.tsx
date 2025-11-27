import { Container, Group, Stack } from "@mantine/core";
import CenteredLoader from "../CenteredLoader";
import PageHeading from "./PageHeading";

export default function PageWithHeading({ children, isLoading, ...props }: Parameters<typeof PageHeading>[0] & { isLoading?: boolean } & { children: React.ReactNode }) {
	return (
		<Stack pb="md" bg="aquahaze" align="stretch">
			<PageHeading {...props} />

			<Group grow>
				<Container size="xl" px={{ base: "lg", md: "xl" }}>
					{isLoading ? <CenteredLoader text="Lade Buchungen..." /> : children}
				</Container>
			</Group>
		</Stack>
	);
}
