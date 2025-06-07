import CardTitle from "@/components/CardTitle";
import PageWithHeading from "@/components/layout/PageWithHeading";
import { Anchor, Card, List, ListItem, Stack, Text, TypographyStylesProvider } from "@mantine/core";

export default function Datenschutz() {
	return (
		<PageWithHeading title="Datenschutzerklärung">
			<TypographyStylesProvider>
				<Stack gap="xl">
					<Card>
						<CardTitle>Grundlegendes</CardTitle>
						<Text>
							Diese Datenschutzerklärung soll die Nutzer dieser Website vcmuellheim.de über die Art, den Umfang und den
							Zweck der Erhebung und Verwendung personenbezogener Daten durch den Websitebetreiber{" "}
							<Anchor href="mailto:bjoern@vcmuellheim.de">Björn Kohnen</Anchor> informieren. Der Websitebetreiber nimmt
							Ihren Datenschutz sehr ernst und behandelt Ihre personenbezogenen Daten vertraulich und entsprechend der
							gesetzlichen Vorschriften. Da durch neue Technologien und die ständige Weiterentwicklung dieser Webseite
							Änderungen an dieser Datenschutzerklärung vorgenommen werden können, empfehlen wir Ihnen sich die
							Datenschutzerklärung in regelmäßigen Abständen wieder durchzulesen. Definitionen der verwendeten Begriffe
							(z.B. &quot;personenbezogene Daten&quot; oder &quot;Verarbeitung&quot;) finden Sie in Art. 4 DSGVO.
						</Text>
						<CardTitle>Berechtigte Interessen des Vereins</CardTitle>
						<Text>
							Zum Zwecke der Außendarstellung werden Fotos der Mitglieder und Fotos von Veranstaltungen auf der
							Vereinswebseite vcmuellheim.de veröffentlicht. Die Rechtsgrundlage hierfür ist Art. 6 Abs. 1 S. 1 lit. a)
							DS-GVO. Die Veröffentlichung personenbezogener Daten im Internet oder in lokalen, regionalen oder
							überregionalen Printmedien erfolgt zur Wahrung berechtigter Interessen des Vereins (vgl. Artikel 6 Abs. 1
							lit. f) DSGVO). Das berechtigte Interesse des Vereins besteht in der Information der Öffentlichkeit durch
							Berichtserstattung über die Aktivitäten des Vereins. In diesem Rahmen werden personenbezogene Daten
							einschließlich von Bildern der Teilnehmer zum Beispiel im Rahmen der Berichterstattung über Ereignisse des
							Vereins veröffentlicht.
						</Text>
						<CardTitle>Ihr Besuch auf unserer Webseite</CardTitle>
						<Text>
							Wir verwenden <u>keine</u> Cookies.
							<br />
							Wir sind <u>keine</u> Marketing Agentur.
							<br />
							Wir haben <u>kein</u> Interesse an Ihren persönlichen Daten oder Ihrem Browserverlauf.
						</Text>
					</Card>
					<Card>
						<CardTitle>Fehlerbehebung und Performance-Überwachung mit Sentry</CardTitle>
						<Text>
							Zur Sicherstellung der Stabilität, Funktionalität und zur fortlaufenden Verbesserung der Performance
							unserer Webseite/Anwendung nutzen wir den Dienst Sentry.io (https://sentry.io/), einen Fehler- und
							Performance-Monitoring-Dienst, bereitgestellt von Functional Software, Inc., dba Sentry, 132 Hawthorne St,
							San Francisco, CA 94107, USA (&quot;Sentry&quot;).
						</Text>
						<CardTitle>Zweck der Verarbeitung:</CardTitle>
						<Text>
							Sentry hilft uns, technische Fehler und Probleme in Echtzeit zu erkennen, zu analysieren und zu beheben.
							Dies ermöglicht es uns, eine reibungslose Funktion und ein optimiertes Nutzererlebnis zu gewährleisten.
						</Text>
						<CardTitle>Datenkategorien:</CardTitle>
						<Text>
							Bei der Nutzung dieses Dienstes können Informationen über technische Fehler und die Performance unserer
							Webseite/Anwendung erfasst werden. Dazu gehören in der Regel:
						</Text>
						<List>
							<ListItem>Browser- und Gerätedaten (z.B. Browsertyp und -version, Betriebssystem, Gerätetyp)</ListItem>
							<ListItem>Details zum Fehler (z.B. Fehlermeldungen, Stack-Traces, Zeitpunkt des Fehlers)</ListItem>
							<ListItem>Informationen zur Performance (z.B. Ladezeiten von Seitenkomponenten)</ListItem>
						</List>
						<Text>
							Wir achten darauf, über Sentry keine personenbezogenen Daten, die eine direkte Identifizierung von Ihnen
							ermöglichen, zu erfassen, es sei denn, diese sind unbeabsichtigt in einer Fehlermeldung enthalten und
							werden von uns umgehend gelöscht oder pseudonymisiert. Sofern IP-Adressen erfasst werden, geschieht dies
							auf Basis unseres berechtigten Interesses an der Sicherheit und Fehlerfreiheit unserer Dienste.
						</Text>
						<CardTitle>Rechtsgrundlage der Verarbeitung:</CardTitle>
						<Text>
							Die Verarbeitung der Daten erfolgt auf Grundlage unseres berechtigten Interesses gemäß Art. 6 Abs. 1 lit.
							f DSGVO. Unser berechtigtes Interesse besteht darin, die technische Stabilität und Sicherheit unserer
							Webseite/Anwendung zu gewährleisten, Fehler zu identifizieren und zu beheben sowie die Performance stetig
							zu optimieren. Datenübermittlung in Drittstaaten:
						</Text>
						<Text>
							Da Sentry ein US-amerikanisches Unternehmen ist, können Daten in die USA übermittelt werden. Die USA
							gelten als Drittstaat ohne angemessenes Datenschutzniveau nach EU-Standards. Sentry hat sich jedoch zur
							Einhaltung geeigneter Garantien zum Schutz Ihrer Daten verpflichtet. Dies erfolgt in der Regel durch den
							Abschluss von Standardvertragsklauseln der EU-Kommission (SCCs) mit Sentry, welche ein angemessenes
							Schutzniveau für Ihre Daten gewährleisten sollen. Weitere Informationen hierzu finden Sie in der
							Datenschutzerklärung von Sentry.
						</Text>
						<CardTitle>Widerruf und Widerspruchsmöglichkeiten:</CardTitle>
						<Text>
							Da die Nutzung von Sentry primär der technischen Fehlerbehebung und Performance-Optimierung dient, ist
							eine separate Opt-Out-Möglichkeit für diesen Dienst in der Regel nicht praktikabel, da dies die
							Fehlererkennung und damit die Funktionalität unserer Webseite/Anwendung beeinträchtigen würde.
						</Text>
						<CardTitle>Weitere Informationen:</CardTitle>
						<Text>
							Weitere Informationen zum Datenschutz bei Sentry finden Sie in deren Datenschutzerklärung unter:
							https://sentry.io/privacy/
						</Text>
					</Card>
				</Stack>
			</TypographyStylesProvider>
		</PageWithHeading>
	);
}
