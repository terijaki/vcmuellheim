"use client";

import { Image } from "@mantine/core";
import { useRouter } from "next/navigation";

export default function HomeIntroLogo() {
	const router = useRouter();

	return (
		<Image
			fit="contain"
			w={{ base: "100%", xs: "80%", sm: "70%", md: "60%", lg: "50%" }}
			mah="40vh"
			src="/images/logo/logo-weiss.png"
			alt="Vereinslogo"
			onContextMenu={(e) => {
				e.preventDefault();
				router.push("/brand");
			}}
		/>
	);
}
