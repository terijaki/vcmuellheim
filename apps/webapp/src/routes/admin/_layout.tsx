/**
 * Admin layout route — applies the CMS AppShell sidebar to all protected admin pages.
 * Shows a login form inline when session is not present (no separate login page needed).
 * Renders only after the initial session check resolves to avoid a flash.
 */

import { Alert, AppShell, Avatar, Burger, Button, Center, Group, Loader, Menu, NavLink, Outlet, PinInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { authClient } from "../../lib/auth-client";
import { getAdminRoutesWithLabels } from "../../utils/adminNavLinks";

export const Route = createFileRoute("/admin/_layout")({
	component: AdminPage,
});

function LoginForm() {
	const [email, setEmail] = useState("");
	const [otp, setOtp] = useState("");
	const [otpSent, setOtpSent] = useState(false);
	const [otpEmail, setOtpEmail] = useState<string | null>(null);
	const [info, setInfo] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const sendCodeInfoMessage = "Wenn die E-Mail-Adresse registriert ist, wurde ein Anmeldecode verschickt.";

	const sendOtp = async (targetEmail: string) => {
		const normalizedEmail = targetEmail.trim().toLowerCase();
		await authClient.emailOtp.sendVerificationOtp({
			email: normalizedEmail,
			type: "sign-in",
		});
		return normalizedEmail;
	};

	const handleSendOtp = async () => {
		if (!email.trim()) return;
		setSubmitting(true);
		setError(null);
		setInfo(null);
		try {
			const normalizedEmail = await sendOtp(email);
			setOtp("");
			setOtpEmail(normalizedEmail);
			setOtpSent(true);
			setInfo(sendCodeInfoMessage);
		} catch {
			setError("Der Anmeldecode konnte gerade nicht angefordert werden. Bitte versuche es erneut.");
		}
		setSubmitting(false);
	};

	const handleVerifyOtp = async (otpValue = otp) => {
		if (!otpEmail || otpValue.length < 6) return;
		setSubmitting(true);
		setError(null);
		const result = await authClient.signIn.emailOtp({
			email: otpEmail,
			otp: otpValue,
		});
		if (result.error) {
			setError(result.error.message || "Ungültiger Code");
		}
		setSubmitting(false);
	};

	return (
		<Center h="100vh">
			<Stack gap="md" w={360} p="xl">
				<Title order={2} ta="center">
					VC Müllheim Anmeldung
				</Title>

				{error && (
					<Alert color="red" variant="light">
						{error}
					</Alert>
				)}
				{info && (
					<Alert color="blue" variant="light">
						{info}
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
							onKeyDown={(e) => e.key === "Enter" && void handleSendOtp()}
							type="email"
							disabled={submitting}
							autoFocus
						/>
						<Button onClick={() => void handleSendOtp()} loading={submitting} disabled={!email.trim()} fullWidth>
							Anmeldecode senden
						</Button>
					</>
				) : (
					<>
						<Text c="dimmed" ta="center" size="sm">
							Falls die Adresse registriert ist, wurde ein Anmeldecode an <strong>{otpEmail}</strong> gesendet. Bitte den 6-stelligen Code eingeben.
						</Text>
						<Stack align="center" gap="md">
							<PinInput
								length={6}
								type="number"
								value={otp}
								onChange={setOtp}
								onComplete={(value) => void handleVerifyOtp(value)}
								disabled={submitting}
								autoFocus
								oneTimeCode
								inputMode="numeric"
								ariaLabel="Anmeldecode"
							/>
						</Stack>
						<Button onClick={() => void handleVerifyOtp()} loading={submitting} disabled={otp.length < 6} fullWidth>
							Anmelden
						</Button>
						<Button
							variant="subtle"
							onClick={async () => {
								if (otpEmail) {
									setOtp("");
									setError(null);
									setInfo(null);
									setSubmitting(true);
									try {
										await sendOtp(otpEmail);
										setInfo(sendCodeInfoMessage);
									} catch {
										setError("Der Anmeldecode konnte gerade nicht angefordert werden.");
									}
									setSubmitting(false);
								}
							}}
							disabled={submitting}
						>
							Code erneut anfordern
						</Button>
						<Button
							variant="subtle"
							color="gray"
							onClick={() => {
								setOtpSent(false);
								setOtp("");
								setError(null);
								setInfo(null);
								setEmail(otpEmail || "");
							}}
							disabled={submitting}
						>
							E-Mail-Adresse ändern
						</Button>
					</>
				)}
			</Stack>
		</Center>
	);
}

function AdminShell() {
	const { data: sessionData } = authClient.useSession();
	const user = sessionData?.user as { id: string; email: string; name?: string; role?: string } | undefined;
	const [opened, { toggle }] = useDisclosure();
	const [isLoggingOut, setIsLoggingOut] = useState(false);

	const logout = async () => {
		setIsLoggingOut(true);
		await authClient.signOut();
		window.location.href = "/admin/bye";
	};

	if (isLoggingOut) {
		return (
			<Center h="100vh">
				<Loader />
			</Center>
		);
	}

	return (
		<AppShell
			header={{ height: 60 }}
			navbar={{
				width: 250,
				breakpoint: "md",
				collapsed: { mobile: !opened },
			}}
			padding="md"
		>
			<AppShell.Header>
				<Group h="100%" px="md" justify="space-between">
					<Group style={{ cursor: "pointer" }}>
						<Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
						<Text size="lg" fw={700} hiddenFrom="sm" component="a" onClick={toggle}>
							VCM
						</Text>
						<Text size="lg" fw={700} visibleFrom="sm" component={Link} to="/admin/dashboard">
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
							<Menu.Item onClick={() => void logout()} leftSection={<LogOut size={16} />}>
								Abmelden
							</Menu.Item>
						</Menu.Dropdown>
					</Menu>
				</Group>
			</AppShell.Header>

			<AppShell.Navbar p="md">
				{getAdminRoutesWithLabels(user?.role === "Admin").map(({ to, label, icon }) => (
					<NavLink key={to} label={label} leftSection={icon} component={Link} to={to} onClick={toggle} style={{ fontWeight: 500 }} />
				))}
			</AppShell.Navbar>

			<AppShell.Main>
				<Outlet />
			</AppShell.Main>
		</AppShell>
	);
}

function AdminPage() {
	const { data: sessionData, isPending } = authClient.useSession();
	const [hasResolvedInitialSession, setHasResolvedInitialSession] = useState(false);

	useEffect(() => {
		if (!isPending) {
			setHasResolvedInitialSession(true);
		}
	}, [isPending]);

	if (!hasResolvedInitialSession && isPending) {
		return (
			<Center h="100vh">
				<Loader />
			</Center>
		);
	}

	if (!sessionData) {
		return <LoginForm />;
	}

	return <AdminShell />;
}
