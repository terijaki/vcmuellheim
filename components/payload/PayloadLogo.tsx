"use client";
import { useTheme } from "@payloadcms/ui";
import Image from "next/image";

export default function PayloadLogo() {
	const { theme } = useTheme();

	if (theme === "dark") {
		return <Image src="/images/logo/logo-weiss.png" width={320} height={182} alt={""} />;
	}

	return <Image src="/images/logo/logo-schwarz-366273.png" width={320} height={128} alt={""} />;
}
