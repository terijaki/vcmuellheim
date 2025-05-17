import { samsClubDataByClubName } from "@/app/utils/sams/sams-server-actions";
import Image from "next/image";
import { FaVolleyball as Ball } from "react-icons/fa6";

export default async function clubLogo({ clubName, className }: { clubName?: string; className?: string }) {
	if (clubName) {
		const clubData = await samsClubDataByClubName(clubName);
		if (clubData?.logo?.url)
			return (
				<div className={`inline-block relative h-5 w-5 ${className}`}>
					<Image
						src={clubData.logo.url}
						fill
						loading="lazy"
						placeholder="empty"
						alt={`Logo: ${clubName}`}
						className="object-contain mix-blend-multiply"
					/>
				</div>
			);
	}

	return <ClubLogoFallback className={className} />;
}

export function ClubLogoFallback({ className }: { className?: string }) {
	return (
		<div className={`inline-flex h-5 w-5 text-lion items-center justify-center ${className}`}>
			<Ball className="p-0.3 opacity-50" />
		</div>
	);
}
