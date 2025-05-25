import HomeFotos from "@/components/homepage/HomeFotos";
import HomeHeimspiele from "@/components/homepage/HomeHeimspiele";
import HomeIntro from "@/components/homepage/HomeIntro";
import HomeKontakt from "@/components/homepage/HomeKontakt";
import HomeMembers from "@/components/homepage/HomeMembers";
import HomeNews from "@/components/homepage/HomeNews";
import HomeSponsors from "@/components/homepage/HomeSponsors";
import HomeTeams from "@/components/homepage/HomeTeams";
import { Center, Loader } from "@mantine/core";
import { Suspense } from "react";

export default async function Page() {
	const CenteredLoader = () => (
		<Center p="md">
			<Loader color="onyx" />
		</Center>
	);

	return (
		<>
			<HomeIntro />
			<HomeNews />
			<Suspense fallback={<CenteredLoader />}>
				<HomeHeimspiele />
			</Suspense>
			{/* <Suspense fallback={<CenteredLoader />}>
				<HomeHeimturnier />
			</Suspense> */}
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
		</>
	);
}
