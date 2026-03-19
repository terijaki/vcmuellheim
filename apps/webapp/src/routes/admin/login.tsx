import { Center } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "@webapp/components/admin/LoginForm";
import { loginPageGuard } from "@webapp/lib/auth-guards";

export const Route = createFileRoute("/admin/login")({
	beforeLoad: ({ context }) => {
		loginPageGuard(context.session);
	},
	component: AdminLoginPage,
});

function AdminLoginPage() {
	return (
		<Center h="100vh">
			<LoginForm />
		</Center>
	);
}
