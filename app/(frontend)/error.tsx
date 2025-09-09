"use client"; // Error components must be Client Components

import { Button, Card, Center, Container, Group, Stack, Text } from "@mantine/core";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import PageWithHeading from "@/components/layout/PageWithHeading";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<PageWithHeading title="Hoppala! 🫢">
			<Container size="sm">
				<Stack gap="xl">
					<Card>
						<Text>Etwas ist schief gelaufen. Der Server konnte dir diesen Bereich ({usePathname()}) nicht fehlerfrei darstellen.</Text>
						<Text>Bitte versuche es zu einem späteren Zeitpunkt noch einmal.</Text>
					</Card>
					<Center>
						<Group>
							<Button
								onClick={
									() => reset() // Attempt to recover by trying to re-render the segment
								}
							>
								Seite neu laden
							</Button>
							<Button component={Link} href="/">
								Zurück zur Startseite
							</Button>
						</Group>
					</Center>
				</Stack>
			</Container>
		</PageWithHeading>
	);
}
