"use client";
import { RefreshRouteOnSave as PayloadLivePreview } from "@payloadcms/live-preview-react";
import { useRouter } from "next/navigation.js";

export function RefreshRouteOnSave() {
	const router = useRouter();

	return <PayloadLivePreview refresh={() => router.refresh()} serverURL={typeof window !== "undefined" ? window.location.origin : ""} />;
}
