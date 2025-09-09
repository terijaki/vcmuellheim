import { Center, Group } from "@mantine/core";
import type { Metadata } from "next";
import { unstable_cacheTag as cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import CenteredLoader from "@/components/CenteredLoader";
import PageWithHeading from "@/components/layout/PageWithHeading";
import Paginator from "@/components/Paginator";
import PictureCard from "@/components/PictureCard";
import { getPictures } from "@/data/pictures";

export const metadata: Metadata = { title: "Fotogalerie" };

export default async function PicturesPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
	// read search params, then query the news
	const { page = 1 } = await searchParams;
	// verify if page is a number, if not set to 1
	const parsedPage = typeof page === "string" && !Number.isNaN(Number(page)) ? Number(page) : 1;
	return (
		<PageWithHeading title="Fotogalerie" subtitle="Eindrücke aus unserem Vereinsleben, von Spieltagen, Turnieren und unseren Mitgliedern.">
			<Suspense fallback={<CenteredLoader text="Lade Fotos..." />}>
				<PictureGrid page={parsedPage} />
			</Suspense>
		</PageWithHeading>
	);
}

async function PictureGrid({ page }: { page: number }) {
	"use cache";
	cacheTag("media");
	const data = await getPictures(60, page);
	const pictures = data?.docs;
	if (pictures?.length === 0) notFound();

	return (
		<>
			<Group gap="xs" justify="center" preventGrowOverflow={false} key={page}>
				{pictures?.map(async (image) => {
					if (!image.url) return null;
					return <PictureCard key={image.id} url={image.url} />;
				})}
			</Group>
			{data?.totalPages && (
				<Center py="xl">
					<Paginator total={data.totalPages} value={page} />
				</Center>
			)}
		</>
	);
}
