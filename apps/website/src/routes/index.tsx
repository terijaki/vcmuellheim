import { Stack } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import HomeIntro from "../components/homepage/HomeIntro";
import HomeKontakt from "../components/homepage/HomeKontakt";
import HomeMembers from "../components/homepage/HomeMembers";

export const Route = createFileRoute("/")({
	component: HomePage,
});

function HomePage() {
	return (
		<Stack gap={0} align="stretch">
			<HomeIntro />
			{/* <HomeInstagram />
			<HomeHeimspiele />
			<HomeTeams />
			<HomeSponsors /> */}
			<HomeMembers />
			{/* <HomeFotos /> */}
			<HomeKontakt />
		</Stack>
	);
}
