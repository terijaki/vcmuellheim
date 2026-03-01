import { Alert, AppShell, Avatar, Burger, Button, Center, Group, Loader, Menu, NavLink, PinInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { getDashboardRoutesWithLabels } from "../utils/nav-links";

function LoginForm() {
	const { sendOtp, verifyOtp, otpSent, otpEmail, error, isLoading } = useAuth();
	const [email, setEmail] = useState("");
	const [otp, setOtp] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [localError, setLocalError] = useState<string | null>(null);

	const handleSendOtp = async () => {
		if (!email.trim()) return;
		setSubmitting(true);
		setLocalError(null);
		try {
			await sendOtp(email.trim());
		} catch (err) {
			setLocalError(err instanceof Error ? err.message : "Fehler beim Senden des Codes");
		} finally {
			setSubmitting(false);
		}
	};

	const handleVerifyOtp = async () => {
		if (!otpEmail || otp.length < 6) return;
		setSubmitting(true);
		setLocalError(null);
		try {
			await verifyOtp(otpEmail, otp);
		} catch (err) {
			setLocalError(err instanceof Error ? err.message : "Ungültiger Code");
		} finally {
			setSubmitting(false);
		}
	};

	const displayError = localError || error;

	return (
		<Center h="100vh">
			<Stack gap="md" w={360} p="xl">
				<Title order={2} ta="center">
					CMS Anmeldung
				</Title>

				{displayError && (
					<Alert color="red" variant="light">
						{displayError}
					</Alert>
				)}

				{!otpSent ? (
					<>
						<Text c="dimmed" ta="center" size="sm">
							Gib deine E-Mail-Adresse ein, um einen Anmeldecode zu erhalten.
						</Text>
						<TextInput
							label="E-Mail-Adresse"
							placeholder="name@vcmuellheim.de"
							value={email}
							onChange={(e) => setEmail(e.currentTarget.value)}
							onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
							type="email"
							disabled={submitting || isLoading}
							autoFocus
						/>
						<Button onClick={handleSendOtp} loading={submitting || isLoading} disabled={!email.trim()} fullWidth>
							Anmeldecode senden
						</Button>
					</>
				) : (
					<>
						<Text c="dimmed" ta="center" size="sm">
							Ein Anmeldecode wurde an <strong>{otpEmail}</strong> gesendet. Bitte den 6-stelligen Code eingeben.
						</Text>
						<Stack align="center" gap="md">
							<PinInput length={6} type="number" value={otp} onChange={setOtp} onComplete={handleVerifyOtp} disabled={submitting} autoFocus />
						</Stack>
						<Button onClick={handleVerifyOtp} loading={submitting} disabled={otp.length < 6} fullWidth>
							Anmelden
						</Button>
						<Button
							variant="subtle"
							onClick={async () => {
								if (otpEmail) {
									setOtp("");
									await sendOtp(otpEmail);
								}
							}}
							disabled={submitting}
						>
							Code erneut senden
						</Button>
					</>
				)}
			</Stack>
		</Center>
	);
}

function DashboardLayout() {
	const { user, logout } = useAuth();
	const [opened, { toggle }] = useDisclosure();
	return (
		<AppShell header={{ height: 60 }} navbar={{ width: 250, breakpoint: "md", collapsed: { mobile: !opened } }} padding="md">
			<AppShell.Header>
				<Group h="100%" px="md" justify="space-between">
					<Group style={{ cursor: "pointer" }}>
						<Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
						<Text size="lg" fw={700} hiddenFrom="sm" component="a" onClick={toggle}>
							VCM
						</Text>
						<Text size="lg" fw={700} visibleFrom="sm" component={Link} to="/dashboard">
							Volleyballclub Müllheim e.V.
						</Text>
					</Group>
					<Menu>
						<Menu.Target>
							<Avatar name={user?.name} color="blumine" variant="light" alt="User Avatar" />
						</Menu.Target>
						<Menu.Dropdown>
							<Menu.Label>{user?.name}</Menu.Label>
							<Menu.Label>{user?.email}</Menu.Label>
							<Menu.Divider />
							<Menu.Item onClick={() => logout()} leftSection={<LogOut size={16} />}>
								Abmelden
							</Menu.Item>
						</Menu.Dropdown>
					</Menu>
				</Group>
			</AppShell.Header>

			<AppShell.Navbar p="md">
				{getDashboardRoutesWithLabels(user?.role === "Admin").map(([{ to, label, icon }]) => (
					<NavLink key={to} label={label} leftSection={icon} component={Link} to={to} onClick={toggle} style={{ fontWeight: 500 }} />
				))}
			</AppShell.Navbar>

			<AppShell.Main>
				<Outlet />
			</AppShell.Main>
		</AppShell>
	);
}

function DashboardPage() {
	const { isLoading, isAuthenticated, isLoggingOut } = useAuth();

	// Still loading - show loader
	if (isLoading) {
		return (
			<Center h="100vh">
				<Loader />
			</Center>
		);
	}

	// Logging out
	if (isLoggingOut) {
		return (
			<Center h="100vh">
				<Loader />
			</Center>
		);
	}

	// Not authenticated - show inline login form
	if (!isAuthenticated) {
		return <LoginForm />;
	}

	// Authenticated - show dashboard
	return <DashboardLayout />;
}

export const Route = createFileRoute("/dashboard")({
	component: DashboardPage,
	errorComponent: ({ error }) => {
		return (
			<Stack h="100vh" w="100vw" align="center" justify="center" gap="md">
				<Title>Fehler</Title>
				<Text>{String(error)}</Text>
			</Stack>
		);
	},
	notFoundComponent: () => {
		return (
			<Stack align="center" justify="center" gap="md" m="xl">
				<Title>404</Title>
				<Text>Seite nicht gefunden</Text>
			</Stack>
		);
	},
});
