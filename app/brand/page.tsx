import React from "react";
import PageHeading from "@/app/components/layout/PageHeading";
import ExportedImage from "next-image-export-optimizer";
import Link from "next/link";

// generate a custom title
import { Metadata, ResolvingMetadata } from "next";
export async function generateMetadata({}, parent: ResolvingMetadata): Promise<Metadata | void> {
	return {
		title: "Brand Guide",
	};
}

export default function StyleGuidePage() {
	return (
		<>
			<PageHeading title="Vereinsfarben & Logo Dateien" />
			{/* colors */}
			<div className="col-center-content my-6 card grid grid-flow-row prose-h2:font-bold prose-h2:text-blumine prose-h2:text-2xl gap-6 *:overflow-hidden">
				<p>Unsere Vereinsfarben werden hier auf der Webseite verwendet und sollten wenn möglich auch in anderem Kontext verwendet werden.</p>

				<div className="text-white grid sm:grid-cols-3 sm:gap-2 rounded sm:*:rounded *:p-2">
					<span className="bg-blumine">Blumine</span>
					<span className="bg-blumine">#366273</span>
					<span className="bg-blumine">rgb(54,98,115)</span>
					<span className="bg-onyx">onyx</span>
					<span className="bg-onyx">#363B40</span>
					<span className="bg-onyx">rgb(54,59,64)</span>
					<span className="bg-turquoise">Türkis</span>
					<span className="bg-turquoise">#01A29A</span>
					<span className="bg-turquoise">rgb(54,59,64)</span>
				</div>
			</div>
			{/* logos */}
			<div className="col-center-content my-6 card grid grid-flow-row prose-h2:font-bold prose-h2:text-blumine prose-h2:text-2xl gap-6 *:overflow-hidden">
				<div key="vektor">
					<h2>Vektorgrafik</h2>
					<p>Vektorgrafiken skalieren dynamisch und eigenen sich daher perfekt für den Druck oder die Beflockung von Trikots.</p>
					<div className="flex flex-col items-center">
						<ExportedImage
							src="images/logo/logo.svg"
							width={505}
							height={288}
							alt={""}
							unoptimized
							className="w-full max-w-lg object-contain inline-block"
						/>
						<div className="flex gap-3">
							<Link
								href={"images/logo/logo.svg"}
								className="button-slim rounded-md"
								download
							>
								Download SVG
							</Link>
							<Link
								href={"images/logo/logo.pdf"}
								className="button-slim rounded-md"
								download
							>
								Download PDF
							</Link>
						</div>
					</div>
				</div>
				<div key="raster">
					<h2>Rastergrafik</h2>
					<p>
						Rastergrafiken haben eine feste Auflösung und das Dateiformat PNG hat eine hohe Kompatibilität. Diese Dateien eignen sich daher für die meisten digitalen Zwecke. Die Auflösung beträgt
						5050x2880 Pixel.
					</p>
					<div className="grid gap-3 items-center grid-cols-2 lg:grid-flow-col auto-cols-fr *:inline-flex *:flex-col *:items-center">
						<div key="black">
							<ExportedImage
								src="images/logo/logo-schwarz.png"
								width={505}
								height={288}
								alt={""}
								unoptimized
								className="w-full max-w-lg mb-3"
							/>
							<Link
								href={"images/logo/logo-schwarz.png"}
								className="button-slim rounded-md"
								download
							>
								Download (Schwarz)
							</Link>
						</div>
						<div key="white">
							<ExportedImage
								src="images/logo/logo-weiss.png"
								width={505}
								height={288}
								alt={""}
								unoptimized
								className="w-full max-w-lg mb-3 rounded-sm bg-onyx/20"
							/>
							<Link
								href={"images/logo/logo-weiss.png"}
								className="button-slim rounded-md"
								download
							>
								Download (Weiß)
							</Link>
						</div>
						<div key="onyx turquoise">
							<ExportedImage
								src="images/logo/logo-363B40-01A29A.png"
								width={505}
								height={288}
								alt={""}
								unoptimized
								className="w-full max-w-lg mb-3"
							/>
							<Link
								href={"images/logo/logo-363B40-01A29A.png"}
								className="button-slim rounded-md"
								download
							>
								Download (Türkis)
							</Link>
						</div>
						<div key="onyx blumine">
							<ExportedImage
								src="images/logo/logo-363B40-366273.png"
								width={505}
								height={288}
								alt={""}
								unoptimized
								className="w-full max-w-lg mb-3"
							/>
							<Link
								href={"images/logo/logo-363B40-366273.png"}
								className="button-slim rounded-md"
								download
							>
								Download (Blumine)
							</Link>
						</div>
					</div>
				</div>
				<div key="raster with background">
					<h2>Rastergrafik mit Hintergrund</h2>
					<p>Fertige Bilddateien mit weißem Logo auf farbigem Hintergrund.</p>
					<div className="grid gap-3 items-center sm:grid-flow-col auto-cols-fr *:inline-flex *:flex-col *:items-center">
						<div key="blumine 366273">
							<ExportedImage
								src="images/logo/logo-366273.png"
								width={500}
								height={500}
								alt={""}
								unoptimized
								className="w-full max-w-lg mb-3"
							/>
							<Link
								href={"images/logo/logo-366273.png"}
								className="button-slim rounded-md"
								download
							>
								Download (Blumine)
							</Link>
						</div>
						<div key="onyx 363B40">
							<ExportedImage
								src="images/logo/logo-363B40.png"
								width={500}
								height={500}
								alt={""}
								unoptimized
								className="w-full max-w-lg mb-3 rounded-sm"
							/>
							<Link
								href={"images/logo/logo-363B40.png"}
								className="button-slim rounded-md"
								download
							>
								Download (Onyx)
							</Link>
						</div>
						<div key="turquoise 01A29A">
							<ExportedImage
								src="images/logo/logo-01A29A.png"
								width={500}
								height={500}
								alt={""}
								unoptimized
								className="w-full max-w-lg mb-3"
							/>
							<Link
								href={"images/logo/logo-01A29A.png"}
								className="button-slim rounded-md"
								download
							>
								Download (Türkis)
							</Link>
						</div>
					</div>
				</div>
			</div>
			{/* jerseys */}
			<div className="col-center-content my-6 card grid grid-flow-row prose-h2:font-bold prose-h2:text-blumine prose-h2:text-2xl *:overflow-hidden prose-p:text-pretty">
				<h2>Trikots</h2>
				<p className="mb-3">
					<span className="font-bold">Farbe:</span> Damit wir Mannschafts- und Jahrgangsübergreifend geschlossen als Verein auftreten können, sollten Trikots in einer Farbe bestellt werden, die der
					Vereinsfarbe <span className="bg-blumine text-white px-1">Blumine</span> ähnelnt. Navy oder Royal Blau sind beispielsweise Farben die von Sportartikelherstellern oft angeboten werden.
				</p>
				<p className="mb-3">
					<span className="font-bold">Marke:</span> ERIMA wird bevorzugt.
				</p>

				<p className="mb-3">
					<span className="font-bold">Beispiele:</span>
				</p>
				<div className="grid sm:grid-cols-2 rounded-lg mb-3 *:w-full *:object-cover *:aspect-video">
					<ExportedImage
						width={600}
						height={400}
						src="images/blog/2023/09/28/hasslachpokal11.jpg"
						alt={""}
					/>
					<ExportedImage
						width={600}
						height={400}
						src="images/blog/2023/12/04/20231203-wa0046.jpg"
						alt={""}
					/>
				</div>
				<p>
					Trikots können bequem in unserem{" "}
					<Link
						href="https://vcmuellheim.fan12.de/kategorien/sportbedarf/oberteile/trikots/?filter_brand=erima"
						className="text-turquoise"
						target="_blank"
						referrerPolicy="no-referrer"
						rel="noreferrer"
					>
						Vereinsshop
					</Link>{" "}
					bestellt werden. Das richtige Vereinslogo ist dort bereits hinterlegt und muss bei der Bestellung nicht bereitgestellt werden.
				</p>
			</div>
		</>
	);
}
