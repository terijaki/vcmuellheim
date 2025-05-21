import PageHeading from "@/components/layout/PageHeading";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = { title: "Brand Guide" };

export default function StyleGuidePage() {
	return (
		<>
			<PageHeading title="Vereinsfarben & Logo Dateien" />
			{/* colors */}
			<div className="col-full-content sm:col-center-content my-6 card grid grid-flow-row prose-h2:font-bold prose-h2:text-blumine prose-h2:text-2xl gap-6 *:overflow-hidden">
				<p>
					Unsere Vereinsfarben werden hier auf der Webseite verwendet und sollten wenn möglich auch in anderem Kontext
					verwendet werden.
				</p>

				<div className="text-white grid grid-cols-2 sm:grid-cols-3 sm:gap-2 rounded sm:*:rounded *:p-2  text-center sm:text-left">
					<span className="bg-blumine col-span-2 sm:col-span-1 text-bold">Blumine</span>
					<span className="bg-blumine">#366273</span>
					<span className="bg-blumine">rgb(54,98,115)</span>
					<span className="bg-onyx col-span-2 sm:col-span-1 text-bold">Onyx</span>
					<span className="bg-onyx">#363B40</span>
					<span className="bg-onyx">rgb(54,59,64)</span>
					<span className="bg-turquoise col-span-2 sm:col-span-1 text-bold">Türkis</span>
					<span className="bg-turquoise">#01A29A</span>
					<span className="bg-turquoise">rgb(54,59,64)</span>
				</div>
			</div>
			{/* logos */}
			<div className="col-full-content sm:col-center-content my-6 card grid grid-flow-row prose-h2:font-bold prose-h2:text-blumine prose-h2:text-2xl gap-6 *:overflow-hidden">
				<div key="vektor">
					<h2>Vektorgrafik</h2>
					<p>
						Vektorgrafiken skalieren dynamisch und eigenen sich daher perfekt für den Druck oder die Beflockung von
						Trikots.
					</p>
					<div className="flex flex-col items-center">
						<Image
							src="images/logo/logo.svg"
							width={505}
							height={288}
							alt={""}
							unoptimized
							className="w-full max-w-lg object-contain inline-block"
						/>
						<div className="flex gap-3">
							<Link href={"images/logo/logo.svg"} className="button-slim rounded-md" download>
								Download SVG
							</Link>
							<Link href={"images/logo/logo.pdf"} className="button-slim rounded-md" download>
								Download PDF
							</Link>
						</div>
					</div>
				</div>
				<div key="raster">
					<h2>Rastergrafik</h2>
					<p>
						Rastergrafiken haben eine feste Auflösung und das Dateiformat PNG hat eine hohe Kompatibilität. Diese
						Dateien eignen sich daher für die meisten digitalen Zwecke. Die Auflösung beträgt 5050x2880 Pixel.
					</p>
					<div className="grid gap-3 items-center grid-cols-2 lg:grid-flow-col auto-cols-fr *:inline-flex *:flex-col *:items-center">
						<div key="black">
							<Image
								src="images/logo/logo-schwarz.png"
								width={505}
								height={288}
								alt={""}
								unoptimized
								className="w-full max-w-lg mb-3"
							/>
							<Link href={"images/logo/logo-schwarz.png"} className="button-slim rounded-md" download>
								Download <br className="sm:hidden" />
								(Schwarz)
							</Link>
						</div>
						<div key="white">
							<Image
								src="images/logo/logo-weiss.png"
								width={505}
								height={288}
								alt={""}
								unoptimized
								className="w-full max-w-lg mb-3 rounded-sm bg-onyx/20"
							/>
							<Link href={"images/logo/logo-weiss.png"} className="button-slim rounded-md" download>
								Download <br className="sm:hidden" />
								(Weiß)
							</Link>
						</div>
						<div key="onyx turquoise">
							<Image
								src="images/logo/logo-363B40-01A29A.png"
								width={505}
								height={288}
								alt={""}
								unoptimized
								className="w-full max-w-lg mb-3"
							/>
							<Link href={"images/logo/logo-363B40-01A29A.png"} className="button-slim rounded-md" download>
								Download <br className="sm:hidden" />
								(Türkis)
							</Link>
						</div>
						<div key="onyx blumine">
							<Image
								src="images/logo/logo-363B40-366273.png"
								width={505}
								height={288}
								alt={""}
								unoptimized
								className="w-full max-w-lg mb-3"
							/>
							<Link href={"images/logo/logo-363B40-366273.png"} className="button-slim rounded-md" download>
								Download <br className="sm:hidden" />
								(Blumine)
							</Link>
						</div>
					</div>
				</div>
				<div key="raster with background">
					<h2>Rastergrafik mit Hintergrund</h2>
					<p>Fertige Bilddateien mit weißem Logo auf farbigem Hintergrund.</p>
					<div className="grid gap-3 items-center sm:grid-flow-col auto-cols-fr *:inline-flex *:flex-col *:items-center">
						<div key="blumine 366273">
							<Image
								src="images/logo/logo-366273.png"
								width={500}
								height={500}
								alt={""}
								unoptimized
								className="w-full max-w-lg mb-3"
							/>
							<Link href={"images/logo/logo-366273.png"} className="button-slim rounded-md" download>
								Download (Blumine)
							</Link>
						</div>
						<div key="onyx 363B40">
							<Image
								src="images/logo/logo-363B40.png"
								width={500}
								height={500}
								alt={""}
								unoptimized
								className="w-full max-w-lg mb-3 rounded-sm"
							/>
							<Link href={"images/logo/logo-363B40.png"} className="button-slim rounded-md" download>
								Download (Onyx)
							</Link>
						</div>
						<div key="turquoise 01A29A">
							<Image
								src="images/logo/logo-01A29A.png"
								width={500}
								height={500}
								alt={""}
								unoptimized
								className="w-full max-w-lg mb-3"
							/>
							<Link href={"images/logo/logo-01A29A.png"} className="button-slim rounded-md" download>
								Download (Türkis)
							</Link>
						</div>
					</div>
				</div>
			</div>
			{/* jerseys */}
			<div className="col-full-content sm:col-center-content my-6 card grid grid-flow-row prose-h2:font-bold prose-h2:text-blumine prose-h2:text-2xl *:overflow-hidden prose-p:text-balance">
				<h2>Trikots</h2>
				<p className="mb-3">
					<span className="font-bold">Farbe:</span> Damit wir Mannschafts- und Jahrgangsübergreifend geschlossen als
					Verein auftreten können, sollten Trikots in einer Farbe bestellt werden, die der Vereinsfarbe{" "}
					<span className="bg-blumine text-white px-1">Blumine</span> ähnelnt. Navy oder Royal Blau sind beispielsweise
					Farben die von Sportartikelherstellern oft angeboten werden.
				</p>
				<p className="mb-3">
					<span className="font-bold">Marke:</span> ERIMA wird bevorzugt.
				</p>

				<p className="mb-3">
					<span className="font-bold">Beispiele:</span>
				</p>
				<div className="grid sm:grid-cols-2 rounded-lg mb-3 *:w-full *:object-cover *:aspect-video">
					<Image width={600} height={400} src="images/blog/2023/09/28/hasslachpokal11.jpg" alt={""} />
					<Image width={600} height={400} src="images/blog/2023/12/04/20231203-wa0046.jpg" alt={""} />
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
					bestellt werden. Das richtige Vereinslogo ist dort bereits hinterlegt und muss bei der Bestellung nicht
					bereitgestellt werden.
				</p>
			</div>
		</>
	);
}
