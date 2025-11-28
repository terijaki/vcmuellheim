import { AspectRatio, Card, Image } from "@mantine/core";
import type { MouseEvent } from "react";

export default function PictureCard({ url }: { url: string }) {
	return (
		<AspectRatio ratio={16 / 9} w={{ base: "100%", xs: 264 }} h={{ base: undefined, xs: (264 / 16) * 9 }}>
			<Card shadow="sm" component="a" href={url} target="_blank" rel="noopener noreferrer">
				<Image
					src={url}
					alt=""
					style={{
						width: "100%",
						height: "100%",
						objectFit: "cover",
						borderRadius: 8,
						zIndex: 1,
						transition: "transform 700ms",
					}}
					onMouseEnter={(e: MouseEvent<HTMLImageElement>) => {
						const img = e.currentTarget as HTMLImageElement;
						img.style.transform = "scale(1.05)";
					}}
					onMouseLeave={(e: MouseEvent<HTMLImageElement>) => {
						const img = e.currentTarget as HTMLImageElement;
						img.style.transform = "scale(1)";
					}}
				/>
			</Card>
		</AspectRatio>
	);
}
