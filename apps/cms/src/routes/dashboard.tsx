import { Alert, AppShell, Avatar, Burger, Button, Center, Group, Loader, Menu, NavLink, PinInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { authClient } from "../lib/auth-client";
import { getDashboardRoutesWithLabels } from "../utils/nav-links";

function LoginForm() {
	const [email, setEmail] = useState("");
	const [otp, setOtp] = useState("");
	const [otpSent, setOtpSent] = useState(false);
	const [otpEmail, setOtpEmail] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const handleSendOtp = async () => {
		if (!email.trim()) return;
		setSubmitting(true);
		setError(null);
		const result = await authClient.emailOtp.sendVerificationOtp({
			email: email.trim(),
			type: "sign-in",
		});
		if (result.error) {
			setError(result.error.message || "OTP konnte nicht gesendet werden");
		} else {
			setOtpEmail(email.trim());
			setOtpSent(true);
		}
		setSubmitting(false);
	};

	const handleVerifyOtp = async () => {
		if (!otpEmail || otp.length < 6) return;
		setSubmitting(true);
		setError(null);
		const result = await authClient.signIn.emailOtp({ email: otpEmail, otp });
		if (result.error) {
			setError(result.error.message || "Ungültiger Code");
		}
		setSubmitting(false);
	};

	return (
		<Center h="100vh">
			<Stack gap="md" w={360} p="xl">
				<Title order={2} ta="center">
					CMS Anmeldung
				</Title>

				{error && (
					<Alert color="red" variant="light">
						{error}
					</Alert>
				)}

				{!otpSent ? (
					<>
						<Text c="dimmed" ta="center" size="sm">
							Gib deine E-Mail-Adresse ein, um einen Anmeldecode zu erhalten.
						</Text>
						<TextInput
							label="E-Mail-Adresse"
							placeholder="erika@example.com"
							value={email}
							onChange={(e) => setEmail(e.currentTarget.value)}
							onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
							type="email"
							disabled={submitting}
							autoFocus
						/>
						<Button onClick={handleSendOtp} loading={submitting} disabled={!email.trim()} fullWidth>
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
									setError(null);
									setSubmitting(true);
									const result = await authClient.emailOtp.sendVerificationOtp({ email: otpEmail, type: "sign-in" });
									if (result.error) {
										setError(result.error.message || "OTP konnte nicht gesendet werden");
									}
									setSubmitting(false);
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
	const { data: sessionData } = authClient.useSession();
	const user = sessionData?.user as { id: string; email: string; name?: string; role?: string } | undefined;
	const [opened, { toggle }] = useDisclosure();
	const [isLoggingOut, setIsLoggingOut] = useState(false);

	const logout = async () => {
		setIsLoggingOut(true);
		await authClient.signOut();
		window.location.href = "/bye";
	};

	if (isLoggingOut) {
		return (
			<Center h="100vh">
				<Loader />
			</Center>
		);
	}

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
							<Menu.Item onClick={logout} leftSection={<LogOut size={16} />}>
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
	const { data: sessionData, isPending } = authClient.useSession();
	const [hasResolvedInitialSession, setHasResolvedInitialSession] = useState(false);

	useEffect(() => {
		if (!isPending) {
			setHasResolvedInitialSession(true);
		}
	}, [isPending]);

	// Only block the page for the first session check.
	if (!hasResolvedInitialSession && isPending) {
		return (
			<Center h="100vh">
				<Loader />
			</Center>
		);
	}

	// Not authenticated - show inline login form
	if (!sessionData) {
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
