import { Anchor, Card, TypographyStylesProvider } from "@mantine/core";
import CardTitle from "@/components/CardTitle";
import PageWithHeading from "@/components/layout/PageWithHeading";

export default function Impressum() {
	return (
		<PageWithHeading title="Impressum">
			<TypographyStylesProvider>
				<Card>
					<CardTitle>Angaben gemäß § 5 TMG</CardTitle>
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
					<strong>Vertreten durch:</strong>
					<p>Lothar Voigt</p>

					<CardTitle>Kontakt</CardTitle>
					<p>
						Telefon: 07631 2472
						<br />
						E-Mail: <Anchor href="mailto:info@vcmuellheim.de">info@vcmuellheim.de</Anchor>
					</p>

					<CardTitle>Redaktionell Verantwortlicher</CardTitle>
					<p>
						Björn Kohnen
						<br />
						E-Mail: <Anchor href="mailto:bjoern@vcmuellheim.de">bjoern@vcmuellheim.de</Anchor>
					</p>

					<CardTitle>Haftung für Inhalte</CardTitle>
					<p>
						Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch
						nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
					</p>
					<p>
						Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem
						Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
					</p>

					<CardTitle>Haftung für Links</CardTitle>
					<p>
						Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die
						Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche
						Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar.
					</p>
					<p>
						Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen werden
						wir derartige Links umgehend entfernen.
					</p>

					<CardTitle>Urheberrecht</CardTitle>
					<p>
						Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter beachtet. Insbesondere werden Inhalte Dritter als solche gekennzeichnet. Sollten
						Sie trotzdem auf eine Urheberrechtsverletzung aufmerksam werden, bitten wir um einen entsprechenden Hinweis. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Inhalte umgehend
						entfernen.
					</p>
				</Card>
			</TypographyStylesProvider>
		</PageWithHeading>
	);
}
