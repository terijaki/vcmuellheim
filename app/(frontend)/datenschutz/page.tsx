import PageHeading from "@/components/layout/PageHeading";

export default function Datenschutz() {
	return (
		<>
			<PageHeading title="Datenschutzerklärung" />
			<div className="col-full-content sm:col-center-content">
				<article className="card my-8 prose max-w-full leading-normal prose-headings:m-0 prose-li:m-auto hyphens-auto lg:hyphens-none">
					<h2>Grundlegendes</h2>
					<p>
						Diese Datenschutzerklärung soll die Nutzer dieser Website vcmuellheim.de über die Art, den Umfang und den
						Zweck der Erhebung und Verwendung personenbezogener Daten durch den Websitebetreiber{" "}
						<a href="mailto:bjoern@vcmuellheim.de">Björn Kohnen</a> informieren. Der Websitebetreiber nimmt Ihren
						Datenschutz sehr ernst und behandelt Ihre personenbezogenen Daten vertraulich und entsprechend der
						gesetzlichen Vorschriften. Da durch neue Technologien und die ständige Weiterentwicklung dieser Webseite
						Änderungen an dieser Datenschutzerklärung vorgenommen werden können, empfehlen wir Ihnen sich die
						Datenschutzerklärung in regelmäßigen Abständen wieder durchzulesen. Definitionen der verwendeten Begriffe
						(z.B. &quot;personenbezogene Daten&quot; oder &quot;Verarbeitung&quot;) finden Sie in Art. 4 DSGVO.
					</p>

					<h2>Berechtigte Interessen des Vereins</h2>
					<p>
						Zum Zwecke der Außendarstellung werden Fotos der Mitglieder und Fotos von Veranstaltungen auf der
						Vereinswebseite vcmuellheim.de veröffentlicht. Die Rechtsgrundlage hierfür ist Art. 6 Abs. 1 S. 1 lit. a)
						DS-GVO. Die Veröffentlichung personenbezogener Daten im Internet oder in lokalen, regionalen oder
						überregionalen Printmedien erfolgt zur Wahrung berechtigter Interessen des Vereins (vgl. Artikel 6 Abs. 1
						lit. f) DSGVO). Das berechtigte Interesse des Vereins besteht in der Information der Öffentlichkeit durch
						Berichtserstattung über die Aktivitäten des Vereins. In diesem Rahmen werden personenbezogene Daten
						einschließlich von Bildern der Teilnehmer zum Beispiel im Rahmen der Berichterstattung über Ereignisse des
						Vereins veröffentlicht.
					</p>

					<h2>Ihr Besuch auf unserer Webseite</h2>
					<p>
						Wir verwenden <u>keine</u> Cookies.
						<br />
						Wir speichern oder verarbeiten <u>keine</u> Daten.
						<br />
						Wir sind <u>keine</u> Marketing Agentur.
						<br />
						Wir haben <u>kein</u> Interesse an Ihren Daten oder Ihrem Browserverlauf.
					</p>
				</article>
			</div>
		</>
	);
}
