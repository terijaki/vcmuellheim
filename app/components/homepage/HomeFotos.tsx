import SectionHeading from "@/app/components/layout/SectionHeading";
import { fetchFotos } from "@/app/utils/fetchFotos";
import ExportedImage from "next-image-export-optimizer";
import Link from "next/link";

export default function HomeFotos() {
	return (
		<section className="col-full-content grid-cols-main-grid bg-gradient-overlay overflow-hidden">
			<a
				id="fotos"
				className="scroll-anchor"
			></a>
			<div className="col-center-content text-white text-center px-4">
				<SectionHeading
					text="Fotos"
					classes="text-white border-white"
				/>
				<p className="text-balance">Eindrücke aus unserem Vereinsleben, von Spieltagen, Turnieren und unseren Mitgliedern findest du in unserer:</p>
				<div className="my-6">
					<Link
						href="/fotos"
						className="button border-white"
					>
						Fotogalerie
					</Link>
				</div>
			</div>

			<div className="absolute inset-0 grid grid-flow-col z-[-10]">
				{fetchFotos(5).map((image, index) => {
					return (
						<div
							key={image}
							className={"relative" + (index == 1 ? " hidden sm:block" : "") + (index == 2 ? " hidden lg:block" : "") + (index == 3 ? " hidden xl:block" : "") + (index > 3 ? " hidden 2xl:block" : "")}
						>
							<ExportedImage
								src={image}
								fill
								className="object-cover"
								alt=""
							/>
						</div>
					);
				})}
			</div>
		</section>
	);
}
