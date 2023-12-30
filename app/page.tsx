import { migratePosts, moveFolder, deleteFolder, deleteFile, replaceString, migrateTeamsToJSON } from "@/app/utils/migration";
import HomeIntro from "@/app/components/homepage/HomeIntro";
import HomeNews from "@/app/components/homepage/HomeNews";
import HomeHeimspiele from "@/app/components/homepage/HomeHeimspiele";
import HomeTeams from "@/app/components/homepage/HomeTeams";
import HomeSponsors from "@/app/components/homepage/HomeSponsors";
import HomeMembers from "@/app/components/homepage/HomeMembers";
import HomeFotos from "@/app/components/homepage/HomeFotos";
import HomeKontakt from "@/app/components/homepage/HomeKontakt";

export default function Page() {
	migrationFromJekyll();

	return (
		<>
			<HomeIntro />
			<HomeNews />
			<HomeHeimspiele />
			<HomeTeams />
			<HomeSponsors />
			<HomeMembers />
			<HomeFotos />
			<HomeKontakt />
		</>
	);
}

function migrationFromJekyll() {
	if (process.env.NODE_ENV === "development") {
		replaceString("_posts", "upload/", "images/blog/");
		// replaceString("_club_members", "img/", "images/");
		// replaceString("_sponsors", "img/", "images/");
		migratePosts();
		// migrateTeamsToJSON();
		// moveFolder("upload", "public/images/blog");
		// moveFolder("logo", "public/images/logo");
		// moveFolder("docs", "public/docs");
		// moveFolder("_sponsors", "data/sponsors");
		// moveFolder("_club_members", "data/clubmembers");
		// moveFolder("_data/sams", "data/sams", true);
		// moveFolder("img", "public/images"); // not needed. moved already
		// deleteFolder("img");
		// deleteFolder("_data");
		// deleteFolder("_matches");
		// deleteFolder("_teams");
		// // Jekyll folders
		// deleteFolder("blog");
		// deleteFolder("assets");
		// deleteFolder("vendor");
		// deleteFolder("_site");
		// deleteFolder("_scss");
		// deleteFolder("_includes");
		// deleteFolder("_layouts");
		// deleteFile("_config.yml");
	}
}
