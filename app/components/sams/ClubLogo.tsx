import { getClubLogoByName } from "@/app/utils/sams/clubs";
import Image from "next/image";
import { FaVolleyball as Ball } from "react-icons/fa6";

export default async function clubLogo(props: { clubName: string; className?: string }) {
	let logo = await getClubLogoByName(props.clubName);

	//TODO fallback if the image cannot be retrieved

	if (logo) {
		return (
			<div className={"inline-block relative h-5 w-5 " + props.className}>
				<Image
					src={logo}
					fill
					loading="lazy"
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
