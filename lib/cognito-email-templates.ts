import { VerificationEmailStyle } from "aws-cdk-lib/aws-cognito";
import { Club } from "../project.config";

export function getCognitoEmailTemplates(cmsDomain: string) {
	const loginUrl = `https://${cmsDomain}`;

	return {
		userInvitation: {
			emailSubject: `Einladung zum ${Club.shortName} CMS`,
			emailBody: `Hallo 👋,\n\ndu wurdest zum ${Club.shortName} Content Management System eingeladen!\n\n\nUm dein Konto zu aktivieren, folge bitte diesen Schritten:\n\n1. Öffne die Login-Seite: ${loginUrl}\n2. Gib deine E-Mail-Adresse ein: {username}\n3. Klicke auf "Passwort vergessen?"\n4. Du erhältst eine E-Mail zum Zurücksetzen deines Passworts\n5. Setze dein persönliches Passwort\n\n\nAlternativ kannst du auch das temporäre Passwort {####} verwenden und beim ersten Login ein neues Passwort festlegen.\n\n\nBei Fragen wende dich bitte an den Administrator.\n\nSportliche Grüße,\n${Club.shortName}`,
		},
		userVerification: {
			emailSubject: `${Club.shortName} - E-Mail bestätigen`,
			emailBody: `Hallo 👋,\n\nvielen Dank für deine Registrierung beim ${Club.shortName} CMS.\n\n\nBitte bestätige deine E-Mail-Adresse, indem du auf den folgenden Link klickst:\n{##E-Mail bestätigen##}\n\n\nFalls du diese E-Mail nicht angefordert hast, kannst du sie ignorieren.\n\nSportliche Grüße,\n${Club.shortName}`,
			emailStyle: VerificationEmailStyle.LINK,
		},
	};
}
