/**
 * better-auth API route — handles all /api/auth/* requests.
 * Passes the incoming Request directly to better-auth's fetch handler.
 */

import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "@webapp/server/auth";

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: ({ request }) => getAuth().handler(request),
			POST: ({ request }) => getAuth().handler(request),
		},
	},
});
