import Paginator from "@/components/Paginator";
import PictureCard from "@/components/PictureCard";
import PageWithHeading from "@/components/layout/PageWithHeading";
import { getPictures } from "@/data/pictures";
import { shuffleArray } from "@/utils/shuffleArray";
import { Center, Group } from "@mantine/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Fotogalerie" };

export default async function PicturesPage({
	searchParams,
}: {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
	// read search params, then query the news
	const { page = 1 } = await searchParams;
	// verify if page is a number, if not set to 1
	const parsedPage = typeof page === "string" && !Number.isNaN(Number(page)) ? Number(page) : 1;
	const data = await getPictures(60, parsedPage);
	const pictures = data?.docs;
	if (pictures?.length === 0) notFound();

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
							return <PictureCard key={image.id} url={image.url} />;
						})}
				</Group>
				{data?.totalPages && (
					<Center py="xl">
						<Paginator total={data.totalPages} value={parsedPage} />
					</Center>
				)}
			</Suspense>
		</PageWithHeading>
	);
}
