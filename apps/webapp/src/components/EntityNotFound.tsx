import { Card, CardSection, Container, Progress, Stack, Text, Title } from "@mantine/core";
import { useRouter } from "@tanstack/react-router";
import { TextSearch } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import CardTitle from "./CardTitle";
import PageWithHeading from "./layout/PageWithHeading";

const DURATION = 20 * 1000; // 20 seconds (in milliseconds)
const UPDATE_SPEED = 100; // Update every 100ms

export default function EntityNotFound({ entityName, title, description }: { entityName: string; title: string; description: string }) {
	const [progress, setProgress] = useState(0);
	const router = useRouter();
	const startTimeRef = useRef<number | null>(null);

	useEffect(() => {
		startTimeRef.current = Date.now();
		const interval = setInterval(() => {
			if (startTimeRef.current === null) return;
			const elapsed = Date.now() - startTimeRef.current;
			const percent = Math.min((elapsed / DURATION) * 100, 100);
			setProgress(percent);
			if (elapsed >= DURATION) {
				clearInterval(interval);
				router.navigate({ to: "/" });
			}
		}, UPDATE_SPEED);
		return () => clearInterval(interval);
	}, [router]);

	const secondsLeft = Number(((DURATION * (100 - progress)) / 100000).toFixed(0));

	return (
		<PageWithHeading title={entityName}>
			<Container>
				<Stack gap="xl">
					<Card ta="center">
						<Title c="blumine">
							<TextSearch size={32} />
						</Title>
						<CardTitle>{title}</CardTitle>
						<Text size="lg" mt="sm">
							{description}
						</Text>
						<CardSection mt="md">
							<Progress value={progress} striped animated size="xs" transitionDuration={UPDATE_SPEED} miw={440} color="turquoise" />
						</CardSection>
					</Card>

					<Container>
						<Text c="dimmed" size="sm" px="md">
							Du wirst {secondsLeft > 0 ? `in ${secondsLeft} Sekunden` : ""} zur Startseite weitergeleitet...
						</Text>
					</Container>
				</Stack>
			</Container>
		</PageWithHeading>
	);
}
