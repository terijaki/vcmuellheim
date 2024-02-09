import { migratePosts, moveFolder, deleteFolder, deleteFile, replaceString, migrateTeamsToJSON } from "@/app/utils/migration";
import HomeIntro from "@/app/components/homepage/HomeIntro";
import HomeNews from "@/app/components/homepage/HomeNews";
import HomeHeimspiele from "@/app/components/homepage/HomeHeimspiele";
import HomeTeams from "@/app/components/homepage/HomeTeams";
import HomeSponsors from "@/app/components/homepage/HomeSponsors";
import HomeMembers from "@/app/components/homepage/HomeMembers";
import HomeFotos from "@/app/components/homepage/HomeFotos";
import HomeKontakt from "@/app/components/homepage/HomeKontakt";
import HomeHeimturnier from "@/app/components/homepage/HomeHeimturnier";

export default function Page() {
	return (
		<>
			<HomeIntro />
			<HomeNews />
			<HomeHeimspiele />
			<HomeHeimturnier />
			<HomeTeams />
			<HomeSponsors />
			<HomeMembers />
			<HomeFotos />
			<HomeKontakt />
		</>
	);
}
