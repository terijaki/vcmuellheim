import { AppShell, AppShellMain, Button, Card, Center, Container, Group, Stack, Text } from "@mantine/core";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import CenteredLoader from "../components/CenteredLoader";
import Footer from "../components/layout/Footer";
import Header, { HEADER_HEIGHT } from "../components/layout/Header";
import PageWithHeading from "../components/layout/PageWithHeading";

export const Route = createRootRoute({
	component: () => (
		<MainLayout>
			<Outlet />
		</MainLayout>
	),
	notFoundComponent: () => (
		<PageWithHeading title="Seite nicht gefunden! 🫤">
			<Container size="sm">
				<Stack gap="xl">
					<Card>
						<Text>Die angeforderte Seite konnte nicht gefunden werden. Bitte überprüfe die URL ({window.location.pathname}) auf Tippfehler.</Text>
						<Text>Falls du denkst, dass dies ein Fehler ist, kontaktiere uns gerne.</Text>
					</Card>
					<Center>
						<Button component={Link} href="/">
							Zurück zur Startseite
						</Button>
					</Center>
				</Stack>
			</Container>
		</PageWithHeading>
	),
	pendingComponent: () => (
		<PageWithHeading title="">
			<CenteredLoader text="Lade Seite..." />
		</PageWithHeading>
	),
	errorComponent: ({ error }) => {
		// TODO: Log error to Sentry
		console.error(error);
		return (
			<MainLayout>
				<PageWithHeading title="Hoppala! 🫢">
					<Container size="sm">
						<Stack gap="xl">
							<Card>
								<Text>Etwas ist schief gelaufen. Der Server konnte dir diesen Bereich ({window.location.pathname}) nicht fehlerfrei darstellen.</Text>
								<Text>Bitte versuche es zu einem späteren Zeitpunkt noch einmal.</Text>
							</Card>
							<Center>
								<Group>
									<Button component={Link} href="/">
										Zurück zur Startseite
									</Button>
								</Group>
							</Center>
						</Stack>
					</Container>
				</PageWithHeading>
			</MainLayout>
		);
	},
});

function MainLayout({ children }: { children: React.ReactNode }) {
	return (
		<AppShell header={{ height: HEADER_HEIGHT, offset: true }} withBorder={false} bg="onyx">
			<Header />
			<AppShellMain bg="aquahaze">
				<Stack justify="space-between" style={{ minHeight: `calc(100vh - ${HEADER_HEIGHT}px)` }}>
					{children}
					<Footer />
				</Stack>
			</AppShellMain>
		</AppShell>
	);
}
