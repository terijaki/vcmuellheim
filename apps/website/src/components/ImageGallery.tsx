import { AspectRatio, Card, Group, Image } from "@mantine/core";

export default async function ImageGallery({ images }: { images?: string[] }) {
	if (!images || images.length === 0) return null;
	const shuffledGallery = images.sort(() => 0.5 - Math.random());

	return (
		<Group gap="xs" justify="center" preventGrowOverflow={false} mt="md">
			{shuffledGallery.map((imageUrl: string, index) => {
				return (
					<AspectRatio key={imageUrl} ratio={16 / 9} w={{ base: "100%", xs: 264 }} h={{ base: undefined, xs: (264 / 16) * 9 }}>
						<Card shadow="sm" component="a" href={imageUrl} target="_blank" rel="noopener noreferrer">
							<Image src={imageUrl} alt={`Foto ${index}`} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
						</Card>
					</AspectRatio>
				);
			})}
		</Group>
	);
}
