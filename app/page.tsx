import HomeIntro from "@/app/components/homepage/HomeIntro";
import HomeNews from "@/app/components/homepage/HomeNews";
import HomeHeimspiele from "@/app/components/homepage/HomeHeimspiele";
import HomeTeams from "@/app/components/homepage/HomeTeams";
import HomeSponsors from "@/app/components/homepage/HomeSponsors";
import HomeMembers from "@/app/components/homepage/HomeMembers";
import HomeFotos from "@/app/components/homepage/HomeFotos";
import HomeKontakt from "@/app/components/homepage/HomeKontakt";
import HomeHeimturnier from "@/app/components/homepage/HomeHeimturnier";
import { Suspense } from "react";

export default function Page() {
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
			<HomeSponsors />
			<HomeMembers />
			<HomeFotos />
			<HomeKontakt />
		</>
	);
}
