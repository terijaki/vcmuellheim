import PageWithHeading from "@/components/layout/PageWithHeading";
import { getPictures } from "@/data/pictures";
import { shuffleArray } from "@/utils/shuffleArray";
import { AspectRatio, Card, CardSection, Group, Image } from "@mantine/core";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Fotogalerie" };

export const dynamic = "force-dynamic";

export default async function PicturesPage() {
	const data = await getPictures();
	const pictures = data?.docs;

	return (
		<PageWithHeading
			title="Fotogalerie"
			subtitle="Eindrücke aus unserem Vereinsleben, von Spieltagen, Turnieren und unseren Mitgliedern. (zufällige Reihenfolge)"
		>
			<Suspense fallback={"Lade Fotos..."}>
				<Group gap="xs" justify="center" preventGrowOverflow={false}>
					{pictures &&
						shuffleArray(pictures)?.map(async (image) => {
							if (!image.url) return null;
							return (
								<Card shadow="sm" component={Link} key={`picture-${image.id}`} href={image.url} target="_blank">
									<CardSection>
										<AspectRatio ratio={16 / 9} maw={{ base: "100%", xs: 264 }}>
											<Image src={image.url} className="transition-transform duration-700 hover:scale-105" alt="" />
										</AspectRatio>
									</CardSection>
								</Card>
							);
						})}
				</Group>
			</Suspense>
		</PageWithHeading>
	);
}
