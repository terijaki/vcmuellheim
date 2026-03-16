import { Club } from "@/project.config";

const HTTP_PROTOCOL_PREFIX_RE = /^https?:\/\//i;

export function createWebcalLink(path: string): string {
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	const origin = typeof window !== "undefined" ? window.location.origin : Club.url;
	const host = origin.replace(HTTP_PROTOCOL_PREFIX_RE, "");

	return `webcal://${host}${normalizedPath}`;
}
