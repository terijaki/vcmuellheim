import { unstable_cacheLife as cacheLife } from "next/cache";
import Image from "next/image";
import Link from "next/link";
import Markdown from "react-markdown";

interface NewsCardProps {
	slug: string;
	title: string;
	content: string;
	thumbnail?: string;
	gallery?: string[];
}

export default async function NewsCard(props: NewsCardProps) {
	"use cache";
	cacheLife("days");

	// check if this post has a thumbnail  TODO: move this all to a {props.thumbnail && "class stuff"}
	let thumbnail = props.thumbnail;
	let thumbnailHeadingClass = "line-clamp-2";
	let thumbnailExperptClass = "line-clamp-5";
	if (!props.thumbnail && props.gallery) {
		const randomIndex = Math.floor(Math.random() * props.gallery.length);
		thumbnail = props.gallery[randomIndex];
	}

	if (thumbnail) {
		// add a class to the heading when a thumbnail is present
		thumbnailHeadingClass = "line-clamp-2 py-1 text-white bg-black/50 row-start-1 row-end-3 place-self-end";
		thumbnailExperptClass = "line-clamp-2 row-start-3 row-end-3";
	}

	return (
		<Link href={`/${encodeURI(props.slug)}`} className="card-narrow overflow-clip select-none grid grid-flow-row group">
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
				className={`mt-3 px-3 w-full text-lg font-bold col-start-1 col-end-2 row-start-1 row-end-2 z-10 ${thumbnailHeadingClass}`}
			>
				{props.title}
			</h1>
			<div className="pb-3 bg-white z-10">
				<Markdown
					components={{
						// replace HTML tags to become spans. this displays everything inline´
						p: "span",
						h1: "span",
						h2: "span",
						h3: "span",
						ol: "span",
						ul: "span",
						br: "span",
						blockquote: "span",
						// turn list items into inline elements and also add a leading hyphen
						li(props) {
							const { node, ...rest } = props;
							return <span className="before:content-['-_']" {...rest} />;
						},
						a(props) {
							const { node, href, ...rest } = props;
							const modifiedProps = href === "" ? { ...rest, href: null } : { ...rest, href };
							return <span className="pointer-events-none" {...modifiedProps} />;
						},
					}}
					className={`px-3 pt-2 font-normal text-gray-700 text-sm prose max-w-full prose-strong:font-normal prose-i:font-normal prose-img:hidden prose-video:hidden prose-div:hidden prose-p:inline prose-p:mr-1 prose-ul:m-0 prose-ol:m-0 prose-li:m-0 ${thumbnailExperptClass}`}
				>
					{props.content
						.replace("<embed", "<embed style='display:none'")
						.replace("<br>", "")
						.replace(/(<([^>]+)>)/gi, "")}
				</Markdown>
			</div>
		</Link>
	);
}
