import PageWithHeading from "@/components/layout/PageWithHeading";
import { Button, Center, Text } from "@mantine/core";
import Link from "next/link";
import { FaTriangleExclamation as IconError } from "react-icons/fa6";

export default function NotFound() {
	return (
		<PageWithHeading title="Seite nicht gefunden">
			<Text size="xl" c="onyx">
				<IconError />
			</Text>
			<Text>Der angefragte Bereich kann nicht gefunden werden.</Text>
			<Center>
				<Button component={Link} href="/">
					zur Startsteite
				</Button>
			</Center>
		</PageWithHeading>
	);
}
