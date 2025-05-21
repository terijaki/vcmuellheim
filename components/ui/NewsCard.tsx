import { unstable_cacheLife as cacheLife } from "next/cache";
import Image from "next/image";
import Link from "next/link";

interface NewsCardProps {
	id: string;
	title: string;
	excerpt: string;
	thumbnails?: string[];
}

export default async function NewsCard(props: NewsCardProps) {
	"use cache";
	cacheLife("days");

	// check if this post has a thumbnail
	let thumbnail = props.thumbnails ? props.thumbnails[0] : undefined;
	let headingClass = "line-clamp-2";
	let experptClass = "line-clamp-5";

	if (thumbnail) {
		// add a class to the heading when a thumbnail is present
		headingClass = "line-clamp-2 py-1 text-white bg-black/50 row-start-1 row-end-3 place-self-end";
		experptClass = "line-clamp-2 row-start-3 row-end-3";
		// if there are multiple thumbnails, pick a random one
		if (props.thumbnails && props.thumbnails.length > 1) {
			const randomIndex = Math.floor(Math.random() * props.thumbnails.length);
			thumbnail = props.thumbnails[randomIndex];
		}
	}

	return (
		<Link href={`/news/${props.id}`} className="card-narrow overflow-clip select-none grid grid-flow-row group">
			{thumbnail && (
				<Image
					width={600}
					height={128}
					priority
					className="h-32 w-full object-cover line-clamp-1 bg-gradient-to-br from-onyx to-blumine col-start-1 col-end-2 row-start-1 row-end-2 z-0 group-hover:scale-105 transition-transform duration-200 group-hover:duration-1000 ease-in-out"
					src={thumbnail}
					alt=""
				/>
			)}
			<h1
				className={`mt-3 px-3 w-full text-lg font-bold col-start-1 col-end-2 row-start-1 row-end-2 z-10 ${headingClass}`}
			>
				{props.title}
			</h1>
			<div className={`pb-3 bg-white z-10 ${experptClass}`}>{props.excerpt}</div>
		</Link>
	);
}
