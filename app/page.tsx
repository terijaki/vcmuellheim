import HomeFotos from "@/app/components/homepage/HomeFotos";
import HomeHeimspiele from "@/app/components/homepage/HomeHeimspiele";
import HomeHeimturnier from "@/app/components/homepage/HomeHeimturnier";
import HomeIntro from "@/app/components/homepage/HomeIntro";
import HomeKontakt from "@/app/components/homepage/HomeKontakt";
import HomeMembers from "@/app/components/homepage/HomeMembers";
import HomeNews from "@/app/components/homepage/HomeNews";
import HomeSponsors from "@/app/components/homepage/HomeSponsors";
import HomeTeams from "@/app/components/homepage/HomeTeams";
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
