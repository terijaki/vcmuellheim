import PageHeading from "@/components/layout/PageHeading";
import Link from "next/link";

export default function Impressum() {
	return (
		<>
			<PageHeading title="Impressum" />
			<div className="col-full-content sm:col-center-content">
				<article className="card my-8 prose max-w-full leading-normal prose-headings:m-0 prose-li:m-auto hyphens-auto lg:hyphens-none">
					<h2>Angaben gemäß § 5 TMG</h2>

					<p>
						Volleyballclub Müllheim e.V.
						<br />
						Lettenstr. 48
						<br />
						79424 Auggen
						<br />
						Vereinsregister: VR 300158
						<br />
						Registergericht: Amtsgericht Freiburg
					</p>

					<h4>Vertreten durch:</h4>
					<p>Lothar Voigt</p>

					<h2>Kontakt</h2>
					<p>
						Telefon: 07631 2472
						<br />
						E-Mail: <Link href="mailto:info@vcmuellheim.de">info@vcmuellheim.de</Link>
					</p>

					<h2>Redaktionell Verantwortlicher</h2>
					<p>
						Björn Kohnen
						<br />
						E-Mail: <Link href="mailto:bjoern@vcmuellheim.de">bjoern@vcmuellheim.de</Link>
					</p>

					<h2>Haftung für Inhalte</h2>
					<p>
						Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen
						Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet,
						übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf
						eine rechtswidrige Tätigkeit hinweisen.
					</p>
					<p>
						Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen
						bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer
						konkreten Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese
						Inhalte umgehend entfernen.
					</p>

					<h2>Haftung für Links</h2>
					<p>
						Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben.
						Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten
						Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich. Die verlinkten Seiten
						wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zum
						Zeitpunkt der Verlinkung nicht erkennbar.
					</p>
					<p>
						Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne konkrete Anhaltspunkte einer
						Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Links
						umgehend entfernen.
					</p>

					<h2>Urheberrecht</h2>
					<p>
						Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter
						beachtet. Insbesondere werden Inhalte Dritter als solche gekennzeichnet. Sollten Sie trotzdem auf eine
						Urheberrechtsverletzung aufmerksam werden, bitten wir um einen entsprechenden Hinweis. Bei Bekanntwerden von
						Rechtsverletzungen werden wir derartige Inhalte umgehend entfernen.
					</p>
				</article>
			</div>
		</>
	);
}
