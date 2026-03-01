import { createFileRoute, Navigate } from "@tanstack/react-router";

// This route is kept for backwards-compatibility but redirects to dashboard.
// With better-auth, login is handled inline via email OTP — no OAuth callback needed.
export const Route = createFileRoute("/auth/callback")({
	component: () => <Navigate to="/dashboard" />,
});
