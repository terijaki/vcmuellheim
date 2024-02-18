import { getClubLogoUrl } from "@/app/utils/sams/getClubLogo";
import ExportedImage from "next-image-export-optimizer";
import { FaVolleyball as Ball } from "react-icons/fa6";

export default async function clubLogo(props: { clubName: string }) {
	let logo = await getClubLogoUrl(props.clubName);
	if (logo) {
		return (
			<div className="relative h-5 w-5 mr-1">
				<ExportedImage
					src={logo}
					fill
					alt={"Logo: " + props.clubName}
					className="object-contain"
				/>
			</div>
		);
	} else {
		return (
			<div className="h-5 w-5 text-lion text-xsflex items-center justify-center">
				<Ball className="p-0.3 opacity-50" />
			</div>
		);
	}
}
