import Image from "next/image";
import { FaVolleyball as Ball } from "react-icons/fa6";

export default async function clubLogo(props: { clubName: string; logo?: string; className?: string }) {
	if (props.logo) {
		return (
			<div className={"inline-block relative h-5 w-5 " + props.className}>
				<Image
					src={props.logo}
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
			<div className={"inline-flex h-5 w-5 text-lion items-center justify-center " + props.className}>
				<Ball className="p-0.3 opacity-50" />
			</div>
		);
	}
}
