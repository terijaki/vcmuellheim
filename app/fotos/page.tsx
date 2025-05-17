import PageHeading from "@/app/components/layout/PageHeading";
import { fetchFotos } from "@/app/utils/fetchFotos";
import type { Metadata, ResolvingMetadata } from "next";
import Image from "next/image";
import Link from "next/link";
import path from "path";
import { Suspense } from "react";

// generate a custom title
export async function generateMetadata(
	{},
	parent: ResolvingMetadata,
): Promise<Metadata> {
	return {
		title: "Fotogalerie",
	};
}

export const dynamic = "force-static"; // ensures the gallery is rendered at build time

export default async function FotosDisplay() {
	const fotos = await fetchFotos();

	return (
		<>
			<PageHeading
				title="Fotogalerie"
				subtitle="Eindrücke aus unserem Vereinsleben, von Spieltagen, Turnieren und unseren Mitgliedern. (zufällige Reihenfolge)"
			/>
			<div className="col-center-content md:col-full-content my-5 md:mx-6 grid gap-3 auto-cols-auto grid-cols-2 md:grid-cols-[repeat(auto-fit,minmax(250px,1fr))] ">
				<Suspense fallback={`Lade ${fotos.length} Fotos...`}>
					{fotos.map(async (image, index) => {
						const isAmongFirstImages = index < 12;

						return (
							<Link
								key={`picture${image}`}
								href={image}
								className="relative group shadow-xs hover:cursor-zoom-in rounded-md overflow-hidden after:opacity-0 hover:after:opacity-100 after:absolute after:inset-0 after:h-full after:w-full after:pointer-events-none hover:after:z-10 after:border-4 after:border-dashed after:border-white after:duration-300 bg-white/50"
								target="_blank"
							>
								<Image
									src={path.join(image)}
									className="object-cover w-full h-full aspect-video sm:aspect-[3/2] m-0 p-0 group-hover:scale-105 transition-transform duration-700"
									width={264}
									height={176}
									priority={isAmongFirstImages}
									alt="zufälliges Foto"
								/>
							</Link>
						);
					})}
				</Suspense>
			</div>
		</>
	);
}
