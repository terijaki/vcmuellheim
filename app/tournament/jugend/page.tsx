import PageHeading from "@/app/components/layout/PageHeading";
import { shuffleArray } from "@/app/utils/shuffleArray";
import matter from "gray-matter";

// generate a custom title
import { Metadata, ResolvingMetadata } from "next";
import ExportedImage from "next-image-export-optimizer";
import Link from "next/link";
export async function generateMetadata({}, parent: ResolvingMetadata): Promise<Metadata | void> {
	return {
		title: "Internationales Jugendturnier 2024",
	};
}

export const pastImageFolders = ["data/posts/2022-07-12-unser-1.jugendturnier-schlug-voll-ein.md", "data/posts/2023-06-21-Zweites-Internationales-Jugendturnier.md"];

export default function JugendturnierPage() {
	let pastImages: string[] = [];
	pastImageFolders.forEach((event) => {
		const { data: frontmatter } = matter.read(event);
		frontmatter.gallery.forEach((image: string) => pastImages.push(image));
	});
	const shuffledPastImages = shuffleArray(pastImages, 12);

	return (
		<>
			<PageHeading
				title="Jugendturnier 2024"
				subtitle="Markgräfler Taxi Cub"
			/>

			<div className="col-full-content sm:col-center-content my-6 card grid grid-flow-row prose-h2:font-bold prose-h2:text-blumine prose-h2:text-2xl gap-6 *:overflow-hidden">
				<h2>Sei dabei!</h2>
				<p>Der Volleyball Club Müllheim veranstaltet dieses Jahr erneut ein internationales Jugendturnier und du bist herzlich eingeladen!</p>
			</div>

			<div className="col-full-content sm:col-center-content my-6 card grid grid-flow-row prose-h2:font-bold prose-h2:text-blumine prose-h2:text-2xl gap-6 *:overflow-hidden">
				<h2>Wann geht es los?</h2>
				<p>
					Am <b>17.06.2023</b> um <b>10:30 Uhr</b> startet das Turnier. Ab 9:45 Uhr ist die Halle geöffnet.
				</p>
				<h2>Wo ist das Turnier?</h2>
				<p>Das Turnier findet in der Sporthalle II, Schwarzwaldstraße 12A, 79379 Müllheim statt. Der Eingang befindet sich in einer Gasse der Bismarckstraße gegenüber des Hebel Parks.</p>
				<p>Die komplette Sporthalle (Abteil A-E) steht für das Volleyballturnier zur Verfügung.</p>
				<h2>Wie wird gespielt?</h2>
				<p>Das Turnier wird für männlich & weiblich wie folgt aufgeteilt:</p>
				<ul>
					<li>Jahrgang 2009 und jünger spielen 6:6</li>
					<li>Jahrgang 2011 und jünger spielen 4:4</li>
				</ul>
				<p>Wir bemühen uns um geringe Wartezeiten für alle Spieler:innen.</p>
				<h2>Welche Kosten entstehen?</h2>
				<p>Wir erheben keine Anmeldegebühr. Spenden werden jedoch gerne angenommen.</p>
				<h2>Was muss ich mitbringen?</h2>
				<p>
					Alle Teilnehmer:innen <u>müssen</u> Hallenschuhe tragen! Wir bitten darum, Essen & Trinken selbst mitzubringen und Abfälle auch selbst wieder mitzunehmen. Direkt neben der Halle befindet
					sich das{" "}
					<Link
						href="https://www.fantasia-kebap-haus-muellheim.de"
						target="_blank"
						rel="noopener"
						className="font-bold text-blumine hover:text-turquoise"
					>
						Kebap Haus Fantasia
					</Link>
					.
				</p>
				<h2>Wie kann ich uns anmelden?</h2>
				<p>
					Für die Anmeldung nutze bitte folgendes Formular:
					<Link
						href="https://forms.gle/pQTcE1Cx9edYuKHF9"
						target="_blank"
						className="font-bold text-blumine hover:text-turquoise"
					>
						https://forms.gle/pQTcE1Cx9edYuKHF9
					</Link>
					<br />
					Der Anmeldeschluss ist der <b>07.06.2024</b>.
				</p>
				<p>
					Sollten wir zu viele Anmeldungen erhalten, verteilen wir fair anhand der Anmeldezeiten und teilen zunächst 1 Mannschaft pro Verein ein. Meldet euch aber trotzdem gerne mit allen Mannschaften
					an, die teilnehmen möchten.
				</p>
			</div>

			<div className="col-full-content sm:col-center-content my-6 card grid grid-flow-row prose-h2:font-bold prose-h2:text-blumine prose-h2:text-2xl gap-6 *:overflow-hidden">
				<h2>Sponsor</h2>
				<p>
					Lorem ipsum dolor sit amet consectetur, adipisicing elit. Dicta, aliquid dignissimos fugiat incidunt tempora quod magni earum soluta, modi libero non quam vero nisi temporibus enim possimus
					officiis, impedit accusamus?
				</p>
			</div>

			<div className="col-full-content sm:col-center-content my-6 card grid grid-flow-row prose-h2:font-bold prose-h2:text-blumine prose-h2:text-2xl gap-6 *:overflow-hidden">
				<h2>Bilder aus den vergangenen Jahren</h2>
				<p className="opacity-70 -mt-4">zufällige Auswahl und Reihenfolge</p>
				<div className="gallery grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-3">
					{shuffledPastImages.map((image) => {
						return (
							<>
								<div className="relative w-auto h-auto aspect-video rounded-md overflow-hidden [&:nth-child(n+5)]:hidden sm:!block">
									<Link
										href={image}
										target="_blank"
										className="group shadow-xs hover:cursor-zoom-in after:opacity-0 hover:after:opacity-100 after:absolute after:inset-0 after:h-full after:w-full after:pointer-events-none hover:after:z-10 after:border-4 after:border-dashed after:border-white after:duration-300"
									>
										<ExportedImage
											src={image}
											fill
											alt={""}
											className="object-cover group-hover:scale-105 transition-transform duration-700"
										/>
									</Link>
								</div>
							</>
						);
					})}
				</div>
			</div>
		</>
	);
}

/* <main class="flex-grow-1">
        
        <div class="col-12">
          <div class="box">
            <h3>Wann geht es los?</h3>
            Am <b>17.06.2023</b> um <b>10:30 Uhr</b> startet das Turnier.<br />Ab 9:45 Uhr ist die Halle geöffnet.
            <h3>Wo ist das Turnier?</h3>
            Das Turnier findet in der Sporthalle II, Schwarzwaldstraße 12A, 79379 Müllheim statt.<br />Der Eingang befindet sich in einer Gasse der Bismarckstraße gegenüber des Hebel Parks.<br />
            Die komplette Sporthalle (Abteil A-E) steht für das Volleyballturnier zur Verfügung.
            <h3>Wie wird gespielt?</h3>
            Das Turnier wird für männlich & weiblich wie folgt aufgeteilt:
            <ul>
              <li>Jahrgang 2009 und jünger spielen 6:6</li>
              <li>Jahrgang 2011 und jünger spielen 4:4</li>
            </ul>
            Wir bemühen uns um geringe Wartezeiten für alle Spieler:innen.
            <h3>Welche Kosten entstehen?</h3>
            Wir erheben keine Anmeldegebühr. Spenden werden jedoch gerne angenommen.
            <h3>Was muss ich mitbringen?</h3>
            Alle Teilnehmer:innen <u>müssen</u> Hallenschuhe tragen!<br />
            Wir bitten darum, Essen & Trinken selbst mitzubringen und Abfälle auch selbst wieder mitzunehmen.<br />
            Direkt neben der Halle befindet sich das <a href="https://www.fantasia-kebap-haus-muellheim.de" target="_blank" rel="noopener">Kebap  Haus Fantasia</a>.
            <h3>Wie kann ich uns anmelden?</h3>
            Für die Anmeldung nutze bitte folgendes Formular:
            <a href="https://forms.gle/pQTcE1Cx9edYuKHF9" target="_blank">https://forms.gle/pQTcE1Cx9edYuKHF9</a><br/>
            Der Anmeldeschluss ist Mittwoch der <b>07.06.2023</b>.<br />
            Sollten wir zu viele Anmeldungen erhalten, verteilen wir fair anhand der Anmeldezeiten und teilen zunächst 1 Mannschaft pro Verein ein. Meldet euch aber trotzdem gerne mit allen Mannschaften an, die teilnehmen möchten.


          </div>
        </div>

        <div class="col-12 col-xl-6">
          <div class="box">
            <h3 class="pb-2 d-none d-lg-block">Karte</h3>
            <div class="container-fluid ratio ratio-16x9">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d981.2971432726546!2d7.625133238726226!3d47.81179536235966!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4791a76a266450d9%3A0xf41bcf4e53026d4e!2sSporthalle%20II!5e0!3m2!1sen!2sde!4v1655294109092!5m2!1sen!2sde"
                width="100%"
                height="100%"
                style="border: 0"
                allowfullscreen=""
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade"
              ></iframe>
            </div>
          </div>
        </div>

        <div class="col-12 col-xl-6">
          <div class="box">
            <h3>Ansprechpersonen</h3>
            <div class="row g-2 mt-2">
              <div class="col-12 col-sm-6 col-lg-4 col-xl-6">
                <p><span class="fw-bold">Klaus-Dieter Ernst</span><br />
                <a href="mailto:klaus@vcmuellheim.de"><i class="fa-solid fa-envelope" aria-hidden="true"></i> klaus@vcmuellheim.de</a><br />
                <span class="fst-italic">Organisatior & Trainer</span><br />
                <img src="/img/members/klausernst2.jpg" class="rounded-circle img-fluid w-100 mt-2 pe-5 pb-2"></p>
              </div>
              <div class="col-12 col-sm-6 col-lg-4 col-xl-6">
                <p><span class="fw-bold">Dominik Ernst</span><br />
                <a href="mailto:dominik@vcmuellheim.de"><i class="fa-solid fa-envelope" aria-hidden="true"></i> dominik@vcmuellheim.de</a><br />
                <span class="fst-italic">Organisatior & Trainer</span><br />
                <img src="/img/members/dominikernst.jpg" class="rounded-circle img-fluid w-100 mt-2 pe-5 pb-2"></p>
              </div>
              <div class="col-12 col-sm-6 col-lg-4 col-xl-6">
                <p><span class="fw-bold">Björn Kohnen</span><br />
                <a href="mailto:bjoern@vcmuellheim.de"><i class="fa-solid fa-envelope" aria-hidden="true"></i> bjoern@vcmuellheim.de</a><br />
                <span class="fst-italic">Koordination</span><br />
                <img src="/img/members/bjoernkohnen.jpg" class="rounded-circle img-fluid w-100 mt-2 pe-5 pb-2"></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</main> */
