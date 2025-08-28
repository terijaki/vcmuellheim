"use client";
import { AspectRatio, Card } from "@mantine/core";
import NextImage from "next/image";
import Link from "next/link";

export default function PictureCard({ url }: { url: string }) {
	return (
		<AspectRatio ratio={16 / 9} w={{ base: "100%", xs: 264 }} h={{ base: undefined, xs: (264 / 16) * 9 }}>
			<Card shadow="sm" component={Link} href={url} target="_blank">
				<NextImage
					src={url}
					fill
					sizes="(max-width: 400px) 270px, 550px"
					style={{
						objectFit: "cover",
						borderRadius: 8,
						zIndex: 1,
						transition: "transform 700ms",
					}}
					alt=""
					onMouseEnter={(e) => {
						e.currentTarget.style.transform = "scale(1.05)";
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.transform = "scale(1)";
					}}
				/>
			</Card>
		</AspectRatio>
	);
}
