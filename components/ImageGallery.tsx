import { AspectRatio, Card, CardSection, Group, Image } from "@mantine/core";
import Link from "next/link";

export default async function ImageGallery({ images }: { images?: string[] }) {
	if (!images || images.length === 0) return null;
	const shuffledGallery = images.sort(() => 0.5 - Math.random());

	return (
		<Group gap="xs" justify="center" preventGrowOverflow={false} mt="md">
			{shuffledGallery.map((imageUrl: string, index) => {
				return (
					<Card shadow="sm" component={Link} key={`Gallerybild ${imageUrl}`} href={imageUrl} target="_blank">
						<CardSection>
							<AspectRatio ratio={16 / 9} maw={{ base: "100%", sm: 296 }}>
								<Image src={imageUrl} alt={`Foto ${index}`} />
							</AspectRatio>
						</CardSection>
					</Card>
				);
			})}
		</Group>
	);
}
