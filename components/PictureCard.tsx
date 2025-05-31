"use client";
import { AspectRatio, Card, CardSection, Image } from "@mantine/core";
import Link from "next/link";

export default function PictureCard({ url }: { url: string }) {
	return (
		<Card shadow="sm" component={Link} href={url} target="_blank">
			<CardSection>
				<AspectRatio ratio={16 / 9} w={{ base: "100%", xs: 264 }} h={{ base: undefined, xs: (264 / 16) * 9 }}>
					<Image
						src={url}
						style={{
							zIndex: 1,
							transition: "transform 700ms",
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.transform = "scale(1.05)";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.transform = "scale(1)";
						}}
						alt=""
					/>
				</AspectRatio>
			</CardSection>
		</Card>
	);
}
