import { Anchor, Card, Text, Typography } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import CardTitle from "../components/CardTitle";
import PageWithHeading from "../components/layout/PageWithHeading";

export const Route = createFileRoute("/beitragsordnung")({
	component: RouteComponent,
});

function RouteComponent() {
	const versionDate = "26.11.2023";

	return (
		<PageWithHeading title="Beitragsordnung" updatedAt={versionDate}>
			<Typography>
				<Card>
					<CardTitle>§ 1 Geschäftsjahr und Fälligkeit</CardTitle>
					<ol>
						<li>Das Geschäftsjahr des Vereins ist das Kalenderjahr.</li>
						<li>
							Der Mitgliedsbeitrag wird am letzten Bankarbeitstag im Januar jeden Jahres eingezogen. Bei einem späteren Vereinseintritt wird der Vereinsbeitrag sofort fällig und innerhalb von 14 Tagen
							eingezogen.
						</li>
					</ol>
					<CardTitle>§ 2 Höhe des Mitgliedbeitrages</CardTitle>
					<ol>
						<li>Die Höhe des Mitgliedbeitrags wird durch die Mitgliederversammlung des Vereins festgelegt.</li>
						<li>Der Mitgliederbeitrag für Kinder und Jugendliche bis zur Vollendung des 16. Lebensjahres beträgt 60,00 Euro.</li>
						<li>Der Beitrag für Jugendliche ab 16 Jahren und Erwachsene beträgt 110,00 Euro.</li>
						<li>Der Beitrag für Familien, unabhängig von der Anzahl der Familienmitglieder, beträgt 165,00 Euro.</li>
						<li>Der Beitrag für passive Mitglieder beträgt 25,00 Euro.</li>
						<li>Bei einem Eintritt ab dem 01.07. eines Jahres wird nur die Hälfte des Jahresbeitrags fällig.</li>
					</ol>
					<CardTitle>§3 Reduzierungen</CardTitle>
					<ol>
						<li>
							Der Beitrag für Jugendliche ab 16 Jahren, und Erwachsene wird bei Vorlage einer entsprechenden Bescheinigung auf 60,00 Euro reduziert, wenn das Mitglied sich noch in der Schule, in einer
							Berufsausbildung oder einem Studium befindet. Die Bescheinigung ist dem Kassenwart bis zum 31.12. eines Jahres für das folgende Kalenderjahr vorzulegen.
						</li>
						<li>
							Der Vorstand kann in begründeten Einzelfällen Beiträge ganz oder teilweise stunden oder erlassen (siehe §5 (2) der <Anchor href="/satzung">Vereinssatzung</Anchor>).
						</li>
					</ol>
					<CardTitle>§ 4 Rechte und Pflichten der Mitglieder</CardTitle>
					<ol>
						<li>Wird der fällige Mitgliedsbeitrag nicht bezahlt, ruht das Stimmrecht des Mitglieds.</li>
						<li>
							Gemäß §4 Vereinssatzung sind die Mitglieder verpflichtet, den Verein über Änderungen in ihren persönlichen Verhältnissen schriftlich zu informieren. Dazu gehört insbesondere:
							<ul>
								<li>die Mitteilung von Anschriftenänderungen</li>
								<li>Änderung der Bankverbindung bei der Teilnahme am Einzugsverfahren</li>
								<li>Mitteilung von persönlichen Veränderungen, die für das Beitragswesen relevant sind (z.B. Beendigung der Schulausbildung, etc.).</li>
							</ul>
						</li>
						<li>
							Nachteile, die dem Mitglied dadurch entstehen, dass es dem Verein die erforderlichen Änderungen nach Abs. 4 nicht mitgeteilt hat (z.B. Bankgebühren für Rücklastschriften), gehen nicht zu
							Lasten des Vereins und können diesem nicht entgegengehalten werden. Entsteht dem Verein dadurch ein Schaden, ist das Mitglied zum Ausgleich verpflichtet.
						</li>
					</ol>
					<CardTitle>§ 5 Beendigung der Mitgliedschaft</CardTitle>
					<ol>
						<li>
							In §6 der <Anchor href="/satzung">Vereinssatzung</Anchor> ist das Procedere bei rückständiger Beitragszahlung geregelt. Dies kann zu einer Streichung von der Mitgliederliste des Vereins
							führen. Verpflichtungen dem Verein gegenüber sind bis zum Ablauf des laufenden Geschäftsjahres zu erfüllen.
						</li>
						<li>
							Der freiwillige Austritt hat in Textform gegenüber einem Mitglied des Vorstands oder der Vereinsgeschäftsstelle erfolgen. Er ist frühestens zum Ende des dem Eintritt folgenden
							Kalenderjahres unter Einhaltung einer Kündigungsfrist von einem Monat zulässig.
						</li>
					</ol>
					<Text c="dimmed" size="xs" ta="right">
						{`Stand ${versionDate}`}
					</Text>
				</Card>
			</Typography>
		</PageWithHeading>
	);
}
