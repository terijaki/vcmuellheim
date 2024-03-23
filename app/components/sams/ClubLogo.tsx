import { getClubLogoUrl } from "@/app/utils/sams/getClubLogo";
import ExportedImage from "next-image-export-optimizer";
import { FaVolleyball as Ball } from "react-icons/fa6";

export default async function clubLogo(props: { clubName: string; className?: string }) {
	let logo = await getClubLogoUrl(props.clubName);
	if (logo) {
		return (
			<div className={"inline-block relative h-5 w-5 " + props.className}>
				<ExportedImage
					src={logo}
					fill
					placeholder="empty"
					alt={"Logo: " + props.clubName}
					className="object-contain mix-blend-multiply"
				/>
			</div>
		);
	} else {
		return (
			<div className={"inline-block h-5 w-5 text-lion text-xsflex items-center justify-center " + props.className}>
				<Ball className="p-0.3 opacity-50" />
			</div>
		);
	}
}
