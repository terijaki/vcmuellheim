import { AspectRatio, Card, Image } from "@mantine/core";

export default function PictureCard({ url, fixedHeight }: { url: string; fixedHeight?: number }) {
	return (
		<AspectRatio ratio={16 / 9} w={fixedHeight ? { base: "100%", xs: fixedHeight } : undefined} h={fixedHeight ? { base: undefined, xs: (fixedHeight / 16) * 9 } : undefined}>
			<Card shadow="sm" component="a" href={url} target="_blank" rel="noopener noreferrer" p={0} radius="md">
				<Image
					loading="lazy"
					src={url}
					alt=""
					style={{
						width: "100%",
						height: "100%",
						objectFit: "cover",
						transition: "transform 700ms ease",
					}}
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
