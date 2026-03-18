import { Stack } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import HomeFotos from "@webapp/components/homepage/HomeFotos";
import HomeHeimspiele from "@webapp/components/homepage/HomeHeimspiele";
import HomeInstagram from "@webapp/components/homepage/HomeInstagram";
import HomeIntro from "@webapp/components/homepage/HomeIntro";
import HomeKontakt from "@webapp/components/homepage/HomeKontakt";
import HomeMembers from "@webapp/components/homepage/HomeMembers";
import HomeNews from "@webapp/components/homepage/HomeNews";
import HomeSponsors from "@webapp/components/homepage/HomeSponsors";
import HomeTeams from "@webapp/components/homepage/HomeTeams";

export const Route = createFileRoute("/_layout/")({
	component: HomePage,
});

function HomePage() {
	return (
		<Stack gap={0} align="stretch">
			<HomeIntro />
			<HomeInstagram />
			<HomeNews />
			<HomeHeimspiele />
			<HomeTeams />
			<HomeSponsors />
			<HomeMembers />
			<HomeFotos />
			<HomeKontakt />
		</Stack>
	);
}
