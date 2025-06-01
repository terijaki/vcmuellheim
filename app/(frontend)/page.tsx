import HomeFotos from "@/components/homepage/HomeFotos";
import HomeHeimspiele from "@/components/homepage/HomeHeimspiele";
import HomeInstagram from "@/components/homepage/HomeInstagram";
import HomeIntro from "@/components/homepage/HomeIntro";
import HomeKontakt from "@/components/homepage/HomeKontakt";
import HomeMembers from "@/components/homepage/HomeMembers";
import HomeNews from "@/components/homepage/HomeNews";
import HomeSponsors from "@/components/homepage/HomeSponsors";
import HomeTeams from "@/components/homepage/HomeTeams";
import { samsClubUpdate } from "@/jobs/tasks/sams-club-update";
import { Center, Loader, Stack } from "@mantine/core";
import { Suspense } from "react";

if (!samsClubUpdate.currentRun()) samsClubUpdate.resume(); // Resume the job if it is paused

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
