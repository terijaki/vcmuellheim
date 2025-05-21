import SectionHeading from "@/components/layout/SectionHeading";
import Link from "next/link";
import {
	FaEnvelope as IconEmail,
	FaFileExcel as IconExcel,
	FaArrowUpRightFromSquare as IconExtern,
} from "react-icons/fa6";

export default function HomeKontakt() {
	return (
		<section className="col-center-content mb-8">
			<div id="kontakt" className="scroll-anchor" />
			<SectionHeading text="Kontakt" />
			<p className="mb-4 text-center text-balance">
				Zögere bitte nicht. Solltest du Fragen an uns haben, oder Interesse mit uns zu trainieren, dann melde dich bei
				uns!
			</p>

			<div className="Q+A grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-4 prose-h3:font-bold prose-a:text-turquoise text-center text-balance">
				<div className="frage">
					<h3>Hast du Interesse an einem Probetrainung?</h3>
					<span>
						Melde dich bitte beim jeweiligen Trainer oder Ansprechperson der Mannschaft (
						<a href="#mannschaften">siehe oben</a>)
					</span>
				</div>

				<div className="frage">
					<h3>Möchtest du dem Verein beitreten?</h3>
					<span>
						Hier gehts zur{" "}
						<Link className="inline-block" href="/beitragsordnung/">
							Beitragsordnung
						</Link>{" "}
						und hier zum{" "}
						<Link
							className="inline-block"
							href="https://vcm.kurabu.com/de/join/"
							target="_blank"
							download={true}
							prefetch={false}
						>
							<IconExtern className="inline-block whitespace-nowrap" /> Anmeldeformular
						</Link>{" "}
						auf unserer Verwaltungssoftware KURABU.
					</span>
				</div>

				<div className="frage">
					<h3>Hast du Fragen zu deiner Mitgliedschaft?</h3>
					<span>
						Melde dich bitte direkt bei Paul Morawietz{" "}
						<Link
							className="inline-block"
							href="mailto:mitgliedschaft@vcmuellheim.de?subject=Volleyball Club Müllheim"
							target="_blank"
						>
							<IconEmail className="inline-block whitespace-nowrap" /> mitgliedschaft@vcmuellheim.de
						</Link>
					</span>
				</div>

				<div className="frage">
					<h3>Hast du Fragen zu deiner Beitragszahlung?</h3>
					<span>
						Melde dich bitte direkt bei Peter Müssig{" "}
						<Link
							className="inline-block"
							href="mailto:kassier@vcmuellheim.de?subject=Volleyball Club Müllheim"
							target="_blank"
						>
							<IconEmail className="inline-block" /> kassier@vcmuellheim.de
						</Link>
					</span>
				</div>

				<div className="frage">
					<h3>Möchtest du Spesen abrechnen?</h3>
					<span>
						Hier findest du die{" "}
						<Link
							className="inline-block"
							href="https://vcmuellheim.de/docs/spesenabrechnung.xlsx"
							download={true}
							prefetch={false}
						>
							<IconExcel className="inline-block" /> Spesenabrechnung
						</Link>{" "}
						und{" "}
						<Link
							className="inline-block"
							href="https://vcmuellheim.de/docs/trainerverguetung.xlsx"
							download={true}
							prefetch={false}
						>
							<IconExcel className="inline-block" /> Trainervergütung
						</Link>
					</span>
				</div>
				<div className="frage">
					<h3>Hast du Fragen zu unserem Branding?</h3>
					<span>
						Farben und Logo Dateien findest du im{" "}
						<Link className="inline-block" href="/brand">
							Brand Guide
						</Link>
					</span>
				</div>

				<div className="frage">
					<h3>Für alle weiteren Anliegen:</h3>
					<span>
						Nutze gerne unseren Mailverteiler{" "}
						<Link className="inline-block" href="mailto:info@vcmuellheim.de" target="_blank">
							<IconEmail className="inline-block" /> info@vcmuellheim.de
						</Link>
					</span>
				</div>
			</div>
		</section>
	);
}
