import PageWithHeading from "@/components/layout/PageWithHeading";
import { Alert, Button, Center, Container, Stack } from "@mantine/core";
import Link from "next/link";
import { FaTriangleExclamation as IconError } from "react-icons/fa6";

export default function NotFound() {
	return (
		<PageWithHeading title="Seite nicht gefunden">
			<Container size="sm" py="xl">
				<Stack gap="xl">
					<Alert variant="white" icon={<IconError />}>
						Der angefragte Bereich kann nicht gefunden werden.
					</Alert>

					<Center>
						<Button component={Link} href="/">
							zur Startsteite
						</Button>
					</Center>
				</Stack>
			</Container>
		</PageWithHeading>
	);
}
