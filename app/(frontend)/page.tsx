import HomeFotos from "@/components/homepage/HomeFotos";
import HomeHeimspiele from "@/components/homepage/HomeHeimspiele";
import HomeHeimturnier from "@/components/homepage/HomeHeimturnier";
import HomeIntro from "@/components/homepage/HomeIntro";
import HomeKontakt from "@/components/homepage/HomeKontakt";
import HomeMembers from "@/components/homepage/HomeMembers";
import HomeNews from "@/components/homepage/HomeNews";
import HomeSponsors from "@/components/homepage/HomeSponsors";
import HomeTeams from "@/components/homepage/HomeTeams";
import { Suspense } from "react";

export default async function Page() {
	return (
		<>
			<HomeIntro />
			<HomeNews />
			<Suspense>
				<HomeHeimspiele />
			</Suspense>
			<Suspense>
				<HomeHeimturnier />
			</Suspense>
			<Suspense>
				<HomeTeams />
			</Suspense>
			<Suspense>
				<HomeSponsors />
			</Suspense>
			<Suspense>
				<HomeMembers />
			</Suspense>
			<Suspense>
				<HomeFotos />
			</Suspense>
			<HomeKontakt />
		</>
	);
}
