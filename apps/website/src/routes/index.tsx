import { Stack } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import HomeIntro from "../components/homepage/HomeIntro";
import HomeKontakt from "../components/homepage/HomeKontakt";
import HomeMembers from "../components/homepage/HomeMembers";
import HomeNews from "../components/homepage/HomeNews";
import HomeSponsors from "../components/homepage/HomeSponsors";
import HomeTeams from "../components/homepage/HomeTeams";

export const Route = createFileRoute("/")({
	component: HomePage,
});

function HomePage() {
	return (
		<Stack gap={0} align="stretch">
			<HomeIntro />
			{/* <HomeInstagram /> */}
			<HomeNews />
			{/* <HomeHeimspiele /> */}
			<HomeTeams />
			<HomeSponsors />
			<HomeMembers />
			{/* <HomeFotos /> */}
			<HomeKontakt />
		</Stack>
	);
}
