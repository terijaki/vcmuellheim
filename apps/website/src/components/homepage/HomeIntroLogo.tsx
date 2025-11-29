import { Image } from "@mantine/core";
import { useRouter } from "@tanstack/react-router";

export default function HomeIntroLogo() {
	const router = useRouter();

	return (
		<Image
			fit="contain"
			w={{ base: "100%", xs: "80%", sm: "70%", md: "65%", lg: "60%" }}
			mah="40vh"
			src={"/images/logo/logo-weiss.png"}
			alt="Vereinslogo"
			onContextMenu={(e) => {
				e.preventDefault();
				router.navigate({ to: "/brand" });
			}}
		/>
	);
}
