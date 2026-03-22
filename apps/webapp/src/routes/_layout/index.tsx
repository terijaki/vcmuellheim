import { Stack, Text, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import HomeFotos from "@webapp/components/homepage/HomeFotos";
import HomeHeimspiele from "@webapp/components/homepage/HomeHeimspiele";
import HomeInstagram from "@webapp/components/homepage/HomeInstagram";
import HomeIntro from "@webapp/components/homepage/HomeIntro";
import HomeIntroLogo from "@webapp/components/homepage/HomeIntroLogo";
import HomeKontakt from "@webapp/components/homepage/HomeKontakt";
import HomeLiveTicker from "@webapp/components/homepage/HomeLiveTicker";
import HomeMembers from "@webapp/components/homepage/HomeMembers";
import HomeNews from "@webapp/components/homepage/HomeNews";
import HomeSponsors from "@webapp/components/homepage/HomeSponsors";
import HomeTeams from "@webapp/components/homepage/HomeTeams";
import { useHomeLiveTickerData } from "@webapp/hooks/useHomeLiveTicker";
import { getHomeIntroBackgroundImageFn } from "@webapp/server/functions/home";

export const Route = createFileRoute("/_layout/")({
	loader: async () => {
		const introBackgroundImage = await getHomeIntroBackgroundImageFn();
		return { introBackgroundImage };
	},
	component: HomePage,
});

function HomePage() {
	const { introBackgroundImage } = Route.useLoaderData();
	const { ourMatches, hasMatchesToday, hasOpenMatches } = useHomeLiveTickerData();

	const introContent = hasMatchesToday ? (
		<Stack gap="md" align="center" style={{ position: "relative", zIndex: 2 }}>
			<Stack gap={0} align="center">
				<Title order={2} c="white" mt="xl" style={{ textWrap: "balance" }} ta="center">
					Willkommen beim Volleyballclub Müllheim
				</Title>
				<Text c="white">{hasOpenMatches ? "Unsere Mannschaften spielen gerade!" : "Unsere Mannschaften haben heute gespielt!"}</Text>
			</Stack>
			<HomeLiveTicker matches={ourMatches} />
		</Stack>
	) : (
		<Stack gap={0} align="center" style={{ position: "relative", zIndex: 2 }}>
			<Text fw="bolder" size="xl" mt="xl">
				Willkommen beim
			</Text>
			<HomeIntroLogo />
		</Stack>
	);

	return (
		<Stack gap={0} align="stretch">
			<HomeIntro backgroundImage={introBackgroundImage} introContent={introContent} />
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
