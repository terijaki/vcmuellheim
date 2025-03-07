"use client";
import ExportedImage from "next-image-export-optimizer";
import Link from "next/link";
import Markdown from "react-markdown";

export default function NewsCard(props: any) {
	// check if this post has a thumbnail  TODO: move this all to a {props.thumbnail && "class stuff"}
	let thumbnail: string = props.thumbnail;
	let thumbnailHeadingClass = "line-clamp-2";
	let thumbnailExperptClass = "line-clamp-5";
	if (!props.thumbnail && props.gallery) {
		let randomIndex = Math.floor(Math.random() * props.gallery.length);
		thumbnail = props.gallery[randomIndex];
	}
	if (thumbnail) {
		// add a class to the heading when a thumbnail is present
		thumbnailHeadingClass = "line-clamp-2 py-1 text-white bg-black/50 row-start-1 row-end-3 place-self-end";
		thumbnailExperptClass = "line-clamp-2 row-start-3 row-end-3";
	}
	return (
		<Link
			key={encodeURI(props.slug)}
			href={"/" + encodeURI(props.slug)}
			className="card-narrow overflow-clip select-none grid grid-flow-row group"
		>
			{thumbnail && (
				<ExportedImage
					width={600}
					height={128}
					priority
					className="h-32 w-full object-cover line-clamp-1 bg-gradient-to-br from-onyx to-blumine col-start-1 col-end-2 row-start-1 row-end-2 z-0 group-hover:scale-105 transition-transform duration-200 group-hover:duration-1000 ease-in-out"
					src={thumbnail}
					alt=""
				/>
			)}
			<h1 className={"mt-3 px-3 w-full text-lg font-bold col-start-1 col-end-2 row-start-1 row-end-2 z-10" + " " + thumbnailHeadingClass}>{props.title}</h1>
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
							const { node, ref, children, ...rest } = props;
							return (
								<span
									className="before:content-['-_']"
									{...rest}
								/>
							);
						},
						a(props) {
							const { node, ref, children, ...rest } = props;
							return (
								<span
									className="pointer-events-none"
									{...rest}
								/>
							);
						},
					}}
					className={"px-3 pt-2 font-normal text-gray-700 text-sm prose max-w-full prose-strong:font-normal prose-i:font-normal prose-img:hidden prose-video:hidden prose-div:hidden prose-p:inline prose-p:mr-1 prose-ul:m-0 prose-ol:m-0 prose-li:m-0" + " " + thumbnailExperptClass}
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
