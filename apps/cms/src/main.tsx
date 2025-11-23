import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "./auth/AuthContext";
import { TRPCProvider } from "./lib/trpc-provider";
import { router } from "./router";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
	<StrictMode>
		<AuthProvider>
			<TRPCProvider>
				<MantineProvider defaultColorScheme="auto">
					<RouterProvider router={router} />
				</MantineProvider>
			</TRPCProvider>
		</AuthProvider>
	</StrictMode>,
);
