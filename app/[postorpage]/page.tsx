import { Metadata, ResolvingMetadata } from "next";
import path from "path";
import fs from "fs";
import matter from "gray-matter";
import Link from "next/link";
import ExportedImage from "next-image-export-optimizer";
import PageHeading from "@/app/components/layout/PageHeading";
import SharingButon from "@/app/components/ui/SharingButton";
import Markdown from "markdown-to-jsx";

// TODO
// - do not generate static file if name is identical to a page OR replace markdown pages with jsx

// list of pages to create
const toStaticGenerate = [
	{
		folder: "data/pages",
		format: [".md", ".mdx"],
	},
	{
		folder: "data/posts",
		format: [".md", ".mdx"],
	},
];

// generate static routes for each markdown post
export async function generateStaticParams(): Promise<{ postorpage: string }[]> {
	let filesToGenerate: string[] = [];
	toStaticGenerate.map((target) => {
		target.format.map((ext) => {
			const files = fs.readdirSync(target.folder);
			const filesFiltered = files.filter((file) => file.endsWith(ext));
			filesFiltered.map((file) => {
				const filesNoExt = file.replace(ext, "");
				filesToGenerate.push(filesNoExt);
			});
		});
	});

	return filesToGenerate.map((param) => ({
		postorpage: param,
	}));
}

// dynamic metadata such as title and open graph
export async function generateMetadata({ params }: { params: { postorpage: string } }, parent: ResolvingMetadata): Promise<Metadata | void> {
	let customMeta = { title: null, thumbnail: null, description: "" };
	toStaticGenerate.map((target) => {
		target.format.map((ext) => {
			const targetFile = path.join(target.folder, params.postorpage) + ext;
			if (fs.existsSync(targetFile)) {
				const postContent = matter.read(targetFile);
				// assign title
				customMeta.title = postContent.data.title;
				// check if a gallery is present and if so assign a random image from the gallery
				if (postContent.data.gallery && postContent.data.gallery.length > 0) {
					postContent.data.gallery.sort(() => 0.5 - Math.random());
					customMeta.thumbnail = postContent.data.gallery;
				}
				// use the date as description
				if (postContent.data.date) {
					customMeta.description = postContent.data.date.toLocaleString("de-DE", { dateStyle: "long", timeStyle: "short" });
				}
			}
		});
	});

	if (customMeta.title && customMeta.thumbnail) {
		return {
			title: customMeta.title,
			openGraph: {
				title: customMeta.title,
				images: [...customMeta.thumbnail],
				description: customMeta.description,
			},
		};
	} else {
		if (customMeta.title) {
			return {
				title: customMeta.title,
			};
		}
	}
}

// display the content of the current [params]
export default function postDisplay({ params }: { params: { postorpage: string } }) {
	let readTarget = null;

	// step 1: read the possible folder + extension combinations from toStaticGenerate
	toStaticGenerate.map((target) => {
		target.format.map((ext) => {
			const testTarget = path.join(target.folder, params.postorpage) + ext;
			// step 2: check if the file exists
			if (fs.existsSync(testTarget)) {
				// step 3: pass the string to be opened
				readTarget = testTarget;
			}
		});
	});

	// step 4: render the file
	if (readTarget) {
		const { data: frontmatter, content: content } = matter.read(readTarget);
		// if there is a thumbnail but not a gallery, make the thumbnail a gallery item
		if (!frontmatter.gallery && frontmatter.thumbnail) {
			frontmatter.gallery = [frontmatter.thumbnail];
		}
		// if the gallery does not include the thumbnail, add it
		if (frontmatter.gallery && frontmatter.thumbnail && !frontmatter.gallery.includes(frontmatter.thumbnail)) {
			frontmatter.gallery.push(frontmatter.thumbnail);
		}
		return (
			<>
				<PageHeading
					title={frontmatter.title}
					subtitle={frontmatter.date && frontmatter.date.toString()}
					subtitleDate={true}
				/>
				<div className="col-full-content sm:col-center-content">
					<article className="card my-8 prose max-w-full leading-normal prose-headings:m-0 prose-li:m-auto hyphens-auto lg:hyphens-none">
						<Markdown>{content}</Markdown>
						{frontmatter.gallery && galleryDisplay(frontmatter.gallery)}
					</article>
					<div className="text-center mb-8">
						<SharingButon label={"Beitrag teilen"} />
					</div>
				</div>
			</>
		);
	}
}

function galleryDisplay(gallery: string[]) {
	const shuffledGallery = gallery.sort(() => 0.5 - Math.random());
	return (
		<div className="grid gap-3 mt-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
			{shuffledGallery.map((galleryItem: string) => {
				return (
					<Link
						key={galleryItem}
						href={galleryItem}
						target="_blank"
						className="relative group hover:cursor-zoom-in rounded-md overflow-hidden after:opacity-0 hover:after:opacity-100 after:absolute after:inset-0 after:h-full after:w-full after:pointer-events-none hover:after:z-10 after:border-[0.4rem] after:border-dashed after:border-white after:duration-300"
					>
						<div className="realtive object-cover aspect-video sm:aspect-[3/2] xl:aspect-[4/3] m-0 p-0 group-hover:scale-105 transition-transform duration-700">
							<ExportedImage
								src={galleryItem}
								width={540}
								height={310}
								alt={"Foto:" + galleryItem}
								className="object-cover h-full w-full m-0 p-0"
							/>
						</div>
					</Link>
				);
			})}
		</div>
	);
}
