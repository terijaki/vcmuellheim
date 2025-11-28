import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { AuthContext } from "../auth/AuthContext";

interface CmsRouterContext {
	auth: AuthContext;
}

export const Route = createRootRouteWithContext<CmsRouterContext>()({
	component: () => <Outlet />,
});
