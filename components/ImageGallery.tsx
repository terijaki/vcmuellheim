import { AspectRatio, Card, Group } from "@mantine/core";
import NextImage from "next/image";
import Link from "next/link";

export default async function ImageGallery({ images }: { images?: string[] }) {
	if (!images || images.length === 0) return null;
	const shuffledGallery = images.sort(() => 0.5 - Math.random());

	return (
		<Group gap="xs" justify="center" preventGrowOverflow={false} mt="md">
			{shuffledGallery.map((imageUrl: string, index) => {
				return (
					<AspectRatio key={imageUrl} ratio={16 / 9} w={{ base: "100%", xs: 264 }} h={{ base: undefined, xs: (264 / 16) * 9 }}>
						<Card shadow="sm" component={Link} href={imageUrl} target="_blank">
							<NextImage src={imageUrl} alt={`Foto ${index}`} fill sizes="(max-width: 400px) 270px, 550px" style={{ objectFit: "cover", borderRadius: 8 }} />
						</Card>
					</AspectRatio>
				);
			})}
		</Group>
	);
}
