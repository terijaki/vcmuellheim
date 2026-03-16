/**
 * better-auth API route — handles all /api/auth/* requests.
 * Passes the incoming Request directly to better-auth's fetch handler.
 */

import { createAPIFileRoute } from "@tanstack/react-start/api";
import { getAuth } from "../../server/auth";

export const APIRoute = createAPIFileRoute("/api/auth/$")({
	GET: ({ request }) => getAuth().handler(request),
	POST: ({ request }) => getAuth().handler(request),
});
