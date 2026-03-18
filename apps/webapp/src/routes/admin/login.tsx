import { Center } from "@mantine/core";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginForm } from "@webapp/components/admin/LoginForm";
import { getCurrentAdminUser } from "@webapp/lib/admin-session";

export const Route = createFileRoute("/admin/login")({
  beforeLoad: async () => {
    const user = await getCurrentAdminUser();
    if (user) {
      throw redirect({ to: "/admin", replace: true });
    }
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
