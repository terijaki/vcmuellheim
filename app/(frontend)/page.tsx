import { Center, Loader, Stack } from "@mantine/core";
import { Suspense } from "react";
import HomeFotos from "@/components/homepage/HomeFotos";
import HomeHeimspiele from "@/components/homepage/HomeHeimspiele";
import HomeInstagram from "@/components/homepage/HomeInstagram";
import HomeIntro from "@/components/homepage/HomeIntro";
import HomeKontakt from "@/components/homepage/HomeKontakt";
import HomeMembers from "@/components/homepage/HomeMembers";
import HomeNews from "@/components/homepage/HomeNews";
import HomeSponsors from "@/components/homepage/HomeSponsors";
import HomeTeams from "@/components/homepage/HomeTeams";
import { samsClubsUpdateTask } from "@/jobs/tasks/sams-clubs-update";
import { samsTeamsUpdateTask } from "@/jobs/tasks/sams-teams-update";

if (!samsTeamsUpdateTask.currentRun()) samsTeamsUpdateTask.resume(); // Resume the job if it is paused
if (!samsClubsUpdateTask.currentRun()) samsClubsUpdateTask.resume(); // Resume the job if it is paused

export default async function Page() {
	const CenteredLoader = () => (
		<Center p="md">
			<Loader color="onyx" />
		</Center>
	);

	return (
		<Stack gap={0}>
			<HomeIntro />
			<HomeNews />
			<Suspense fallback={<CenteredLoader />}>
				<HomeInstagram />
			</Suspense>
			<Suspense fallback={<CenteredLoader />}>
				<HomeHeimspiele />
			</Suspense>
			<Suspense fallback={<CenteredLoader />}>
				<HomeTeams />
			</Suspense>
			<Suspense fallback={<CenteredLoader />}>
				<HomeSponsors />
			</Suspense>
			<Suspense fallback={<CenteredLoader />}>
				<HomeMembers />
			</Suspense>
			<Suspense fallback={<CenteredLoader />}>
				<HomeFotos />
			</Suspense>
			<HomeKontakt />
		</Stack>
	);
}
