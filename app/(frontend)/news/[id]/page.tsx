import PageHeading from "@/components/layout/PageHeading";
import SharingButon from "@/components/ui/SharingButton";
import { getNewsItem } from "@/data/news";
import { RichText } from "@payloadcms/richtext-lexical/react";
import Image from "next/image";
import Link from "next/link";

export default async function NewsPage({ params }: { params: { id: string } }) {
	const data = await getNewsItem(params.id);
	if (!data) return null; // TODO better error 404 handling

	// filter out the thumbnail urls
	const thumbnails = data.images?.map((i) => (typeof i === "string" ? i : i.url)).filter((i) => typeof i === "string");

	return (
		<>
			<PageHeading title={data.title} subtitle={data.publishedDate} subtitleDate={true} />
			<div className="col-full-content sm:col-center-content">
				<article className="card my-8 prose max-w-full leading-normal prose-headings:m-0 prose-li:m-auto hyphens-auto lg:hyphens-</div>none">
					<RichText data={data.content} />
					{thumbnails && <GalleryDisplay images={thumbnails} />}
				</article>
				<SharingButon label={"Beitrag teilen"} wrapper={true} />
			</div>
		</>
	);
}

async function GalleryDisplay({ images }: { images: string[] }) {
	const shuffledGallery = images.sort(() => 0.5 - Math.random());

	return (
		<div className="grid gap-3 mt-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
			{shuffledGallery.map(async (imageUrl: string, index) => {
				return (
					<Link
						key={`Gallerybild ${imageUrl}`}
						href={imageUrl}
						target="_blank"
						className="relative group hover:cursor-zoom-in rounded-md overflow-hidden after:opacity-0 hover:after:opacity-100 after:absolute after:inset-0 after:h-full after:w-full after:pointer-events-none hover:after:z-10 after:border-[0.4rem] after:border-dashed after:border-white after:duration-300 bg-blumine/25"
					>
						<div className="realtive object-cover aspect-video sm:aspect-[3/2] xl:aspect-[4/3] m-0 p-0 group-hover:scale-105 transition-transform duration-700">
							<Image
								src={imageUrl}
								width={540}
								height={310}
								alt={`Foto ${index}`}
								className="object-cover h-full w-full m-0 p-0"
							/>
						</div>
					</Link>
				);
			})}
		</div>
	);
}
